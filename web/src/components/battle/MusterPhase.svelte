<script lang="ts">
  // The muster (UI4 Task 3; spec 2026-09-29 §5, the pace-and-aids screen): the order of battle on the
  // parchment. The resume ribbon when a dictation or a proofreading waits, with a one-line reminder of
  // the aids taken; otherwise the title over one line of tags, Éris's taunt on her voice plate (Ruling
  // C7), then « Ton rythme » and « Tes aides » side by side on a wide parchment (one column on a narrow
  // one), and a start bar that stays in view (plan Ruling R7): the glory this battle is worth, the
  // suggestion if any, « Commencer la dictée » and the grimoire's way (Ruling R8). The grimoire shows
  // only the aids and « Ouvrir le grimoire ». One screen, no scrolling, at 1280×800 and on the iPad.
  // On the first dictation muster the dragon's tour takes the taunt's plate (spec 2026-09-29
  // explanations §2, plan R11).
  import { untrack } from 'svelte';
  import OverlayVoice from '../scene/OverlayVoice.svelte';
  import AidToggles from './AidToggles.svelte';
  import MusterTour from './MusterTour.svelte';
  import PaceMedallions from './PaceMedallions.svelte';
  import { AID_LABELS, bonusParts, suggestion, type RecentDefence } from '../../lib/aids';
  import { api } from '../../lib/api';
  import { audioSettings, setChannel } from '../../lib/audio/store.svelte';
  import { MUSTER } from '../../lib/battle/lines';
  import { battleStage, react } from '../../lib/battle/stage.svelte';
  import { reducedMotion } from '../../lib/juice/motion';
  import { isProphecy } from '../../lib/dates';
  import { PACES, PACE_LABELS, type Pace } from '../../lib/dictation/script';
  import type { PlayState } from '../../lib/playState';
  import { paceBonus, prophecyBonusApplies, type GameRules } from '../../lib/rules';
  import { go } from '../../lib/scene/panelNav';
  import { href } from '../../lib/routes';
  import type { DialogueLine } from '../../lib/scene/types';
  import { longDate } from '../../lib/text/french';
  import { MARK_ICONS } from '../../lib/world/art';
  import type { PlayMode, TextFull } from '../../lib/types';

  let {
    text,
    mode,
    playState = $bindable(),
    minPace,
    rules,
    recent,
    questId,
    encounter,
    resume,
    corrupting,
    corruptError,
    taunt,
    tour = null,
    onTourDone = () => {},
    profileId,
    onContinue,
    onRestart,
    onStart,
    onOpenGrimoire,
    onToLibrary,
  }: {
    text: TextFull;
    mode: PlayMode;
    /** Bound for the pace and the aids' choice. */
    playState: PlayState;
    minPace: Pace;
    /** The camp's rules (spec 2026-09-29 §7): the fight's threshold, the bonuses. */
    rules: GameRules;
    /** The last defences (the stats' recent sessions), for the suggestion (spec §3). */
    recent: readonly RecentDefence[];
    questId: number | null;
    encounter: string | null;
    /** A saved dictation or proofreading waits: the resume ribbon instead of the order of battle. */
    resume: boolean;
    corrupting: boolean;
    corruptError: string | null;
    /** Éris's line at the muster (Ruling C7), on her voice plate. */
    taunt: DialogueLine | null;
    /** The muster's first-visit tour (R11), or null. */
    tour?: { lines: DialogueLine[]; targets: (string | null)[] } | null;
    onTourDone?: () => void;
    profileId: number;
    onContinue: () => void;
    onRestart: () => void;
    onStart: () => void;
    onOpenGrimoire: () => void;
    onToLibrary: () => void;
  } = $props();

  // Intro-only: never toggled during dictation/proofreading (the photo is the reference,
  // spec §3.2 - it must stay hidden while the child is writing).
  let showPhotos = $state(false);

  // The lieutenant on stage stays the opponent of the grimoire way. The quest stays behind (the review
  // asked for the encounter only): whether a grimoire counts for a quest is the server's rule.
  const grimoireQuery = $derived(encounter ? { encounter } : undefined);

  // « Reprendre mon brouillon » resumes a saved dictation at its saved pace, so the ribbon names it
  // (pace-bug report 2026-09-27, open item 1); « Tout recommencer » is the way to another. A saved
  // proofreading (a grimoire's always is) has no pace left: « Reprendre ma relecture ».
  const proofreading = $derived(playState.phase === 'proofreading');
  const continueLabel = $derived(proofreading ? MUSTER.continueProof : MUSTER.continueAt(PACE_LABELS[playState.pace].title));

  // Spec §5: two columns from a 40 rem parchment (1280×800, the iPad in landscape), one below it (Ruling R6).
  const REM = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  let width = $state(0);
  const wide = $derived(width >= 40 * REM);

  const paceBonuses = $derived(Object.fromEntries(PACES.map((p) => [p, paceBonus(p, mode, rules)])) as Record<Pace, number>);
  const bonus = $derived(
    bonusParts({ pace: playState.pace, mode, aids: playState.aids, prophecy: prophecyBonusApplies(text.due_date) }, rules),
  );
  // Only ever suggested (spec §3): the toggles stay as the child set them.
  const suggested = $derived(suggestion(recent, playState.aids, rules));
  const suggestionLine = $derived(
    suggested === null
      ? null
      : suggested.kind === 'leave'
        ? MUSTER.suggestLeave(AID_LABELS[suggested.aid].the)
        : MUSTER.suggestTake(AID_LABELS[suggested.aid].the),
  );

  function credits(t: TextFull): string {
    if (t.credits) return t.credits;
    if (t.source === 'custom' && t.added_by_name) return `Ajouté par ${t.added_by_name}`;
    return '';
  }

  // R11: the tour's step lights its part of the parchment (a gold outline), and only while it speaks.
  let root = $state<HTMLDivElement>();
  let tourTarget = $state<string | null>(null);
  $effect(() => {
    const t = tour ? tourTarget : null;
    const node = root;
    if (!t || !node) return;
    const el = node.querySelector<HTMLElement>(`[data-tour-part="${t}"]`);
    if (!el) return;
    el.setAttribute('data-tour-lit', '');
    el.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    return () => el.removeAttribute('data-tour-lit');
  });

  // Final review M6: the tour's own buttons leave with its plate, so focus goes on to « Commencer la
  // dictée », the button its last line points at, rather than falling to <body>.
  function endTour() {
    onTourDone();
    root?.querySelector<HTMLElement>('[data-testid="btn-start"]')?.focus();
  }

  // The two sides square up: the opponent taunts, the dragon braces (Ruling C10). Again for each new
  // battle on this muster (« Tout recommencer » resets the stage under it, final review I2).
  $effect(() => {
    void battleStage.generation;
    untrack(() => {
      react('opponent', 'taunt');
      react('dragon', 'brace');
    });
  });
</script>

<div
  class="muster"
  class:short={mode === 'grimoire' && !resume}
  class:with-bar={!resume}
  class:wide
  data-testid="muster"
  data-layout={wide ? 'wide' : 'narrow'}
  bind:clientWidth={width}
  bind:this={root}
>
  {#if resume}
    <div class="resume">
      <h2 class="muster-title">{text.title}</h2>
      <div class="resume-sheet" data-testid="battle-resume">
        <p class="kit-ribbon">{MUSTER.resume(proofreading)}</p>
        <div class="actions">
          <button type="button" class="kit-bronze" data-testid="battle-resume-continue" onclick={onContinue}>{continueLabel}</button>
          <button type="button" class="kit-bronze is-quiet" data-testid="battle-resume-restart" onclick={onRestart}>{MUSTER.restart}</button>
        </div>
        <p class="aids-reminder" data-testid="muster-aids-reminder">{MUSTER.aidsReminder(playState.aids.map((k) => AID_LABELS[k].the))}</p>
      </div>
    </div>
  {:else}
    <header class="head">
      <h2 class="muster-title">{mode === 'grimoire' ? MUSTER.grimoire : text.title}</h2>
      <div class="tags">
        <span class="kit-tag" data-testid="muster-words">{MUSTER.words(text.word_count)}</span>
        {#if questId}
          <span class="kit-tag quest" data-testid="play-quest-banner">
            <span class="kit-seal" aria-hidden="true"><img src={MARK_ICONS.oracleSeal} alt="" /></span>{MUSTER.quest}
          </span>
        {/if}
        {#if text.due_date && isProphecy(text.due_date)}
          <span class="kit-prophecy" data-testid="play-prophecy">{MUSTER.prophecy(longDate(text.due_date))}</span>
        {/if}
        {#if credits(text)}<span class="credits">{credits(text)}</span>{/if}
      </div>
      {#if encounter === 'eris'}
        <p class="kit-note" data-tone="eris" data-testid="play-boss-banner">{MUSTER.boss(rules.fight_max_per_100)}</p>
      {/if}
    </header>

    {#if tour && mode !== 'grimoire'}
      <MusterTour lines={tour.lines} targets={tour.targets} onStep={(t) => (tourTarget = t)} onDone={endTour} />
    {:else if taunt}
      <OverlayVoice line={taunt} testId="battle-voice" />
    {/if}

    <!-- UI5 Ruling E7: a muted voice is never a trap - the dictation keeps its pace but reads nothing
         aloud, so the muster says so and gives the voice back in one tap. -->
    {#if mode !== 'grimoire' && audioSettings.voice.muted}
      <p class="kit-note voice-muted" data-testid="battle-voice-muted">
        {MUSTER.voiceMuted}
        <button type="button" class="kit-link" data-testid="battle-voice-unmute" onclick={() => setChannel(profileId, 'voice', { muted: false })}>{MUSTER.voiceBack}</button>
      </p>
    {/if}

    {#if text.photo_count > 0}
      <div class="sheet-fold">
        <button type="button" class="kit-link" aria-expanded={showPhotos} onclick={() => (showPhotos = !showPhotos)}>
          {showPhotos ? MUSTER.hideSheet : MUSTER.showSheet}
        </button>
        {#if showPhotos}
          <div class="scan-photos">
            {#each Array.from({ length: text.photo_count }, (_, i) => i + 1) as n (n)}
              <img src={api.scan.pageUrl(text.scan_id ?? '', n)} alt={MUSTER.sheetAlt(n)} class="scan-photo" />
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if mode === 'grimoire'}
      <p class="rule">{MUSTER.grimoireRule}</p>
      <AidToggles bind:aids={playState.aids} {rules} {wide} highlight={suggested?.aid ?? null} />
      <div class="start-bar">
        <div class="bar-words">
          <p class="total" data-testid="muster-bonus">
            {MUSTER.total(bonus.total)}
            {#if bonus.prophecy > 0}<span class="kit-tag prophecy-bonus" data-testid="muster-prophecy-bonus">{MUSTER.prophecyTag(bonus.prophecy)}</span>{/if}
          </p>
          {#if suggestionLine}<p class="suggestion" data-testid="muster-suggestion">{suggestionLine}</p>{/if}
        </div>
        {#if corruptError}
          <div class="kit-note" data-tone="eris" role="alert">
            <p>{corruptError}</p>
            <button type="button" class="kit-bronze is-quiet" data-testid="btn-back-library" onclick={onToLibrary}>{MUSTER.backToShelves}</button>
          </div>
        {:else if corrupting}
          <p class="kit-ribbon waiting">{MUSTER.corrupting}</p>
        {:else}
          <button type="button" class="kit-bronze grand" data-testid="btn-open-grimoire" onclick={onOpenGrimoire}>{MUSTER.openGrimoire}</button>
        {/if}
      </div>
    {:else}
      <div class="choices">
        <PaceMedallions bind:pace={playState.pace} {minPace} bonuses={paceBonuses} row={!wide} />
        <AidToggles bind:aids={playState.aids} {rules} {wide} highlight={suggested?.aid ?? null} />
      </div>
      <div class="start-bar">
        <div class="bar-words">
          <p class="total" data-testid="muster-bonus" data-tour-part="bonus">
            {MUSTER.total(bonus.total)}
            {#if bonus.prophecy > 0}<span class="kit-tag prophecy-bonus" data-testid="muster-prophecy-bonus">{MUSTER.prophecyTag(bonus.prophecy)}</span>{/if}
          </p>
          {#if suggestionLine}<p class="suggestion" data-testid="muster-suggestion">{suggestionLine}</p>{/if}
        </div>
        <div class="start-row">
          <button type="button" class="kit-bronze grand" data-testid="btn-start" onclick={onStart}>{MUSTER.start}</button>
          <!-- UI4 playability #8: the fight against Éris has one way in and no side door; a lieutenant's
               grimoire keeps its encounter, so it is still that lieutenant's battle. -->
          {#if encounter !== 'eris'}
            <button
              type="button"
              class="kit-bronze is-quiet"
              data-testid="btn-grimoire"
              onclick={() => go(href('grimoire', { profileId: String(profileId), textId: String(text.id) }, grimoireQuery))}
            >
              {MUSTER.grimoire}
            </button>
          {/if}
        </div>
      </div>
      {#if encounter !== 'eris'}<p class="caption">{MUSTER.grimoireCaption}</p>{/if}
    {/if}
  {/if}
</div>

<style>
  /* The parchment has a fixed height (the stage's); the muster scrolls inside it. A hugging
     parchment (BattleStage `hug`) is as tall as its muster (`height: fit-content`), so the muster's
     flex basis is its content (`auto`), never `flex: 1`'s 0 %: iPad Safari resolved that 0 % against
     the parchment's insets, to 0, and the parchment collapsed to a strip thinner than its title
     (iPad report 2026-09-28). It still grows into a fixed parchment and shrinks to scroll inside. */
  .muster {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 20px;
    color: var(--ink);
    font-family: var(--font-body);
    /* UI5 playability #22: the foot of the parchment fades out, so a line cut by its edge reads as
       "more below", never as half a line of letters. */
    -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 26px), transparent);
    mask-image: linear-gradient(180deg, #000 calc(100% - 26px), transparent);
  }
  /* ...and scrolled to the end, the last line clears that fade by a line's height (a spacer, not
     padding: a flex column's bottom padding is lost to the scroll in older WebKit). */
  .muster::after {
    content: '';
    flex: none;
    height: 1.4em;
    margin-top: -14px;
  }
  .muster > :global(*) {
    flex: none;
  }
  /* The grimoire's muster is short: centred in the parchment's height, as Éris's lair is (Task 8
     walk c03: it left the lower half of the parchment empty); from the top when it overflows. */
  .muster.short > :global(:first-child) {
    margin-top: auto;
  }
  .muster.short > :global(:last-child) {
    margin-bottom: auto;
  }
  /* Éris's plate, a notch smaller on the order of battle, so the choices and the start bar fit. */
  .muster :global(.overlay-voice) {
    margin: 0;
    padding: 4px 14px 4px 6px;
  }
  .muster :global(.voice-portrait) {
    width: 52px;
    height: 52px;
  }
  .muster :global(.voice-text) {
    font-size: 17px;
    line-height: 1.3;
  }
  /* R11: the part the tour speaks of (the pace, the aids, the total), outlined in gold. A deep gold
     line, wide and set off the part, with a light halo outside it, so it reads on the cream parchment
     and never looks like the pale ring of a suggested aid (AidToggles' .suggested) inside it. */
  .muster :global([data-tour-lit]) {
    outline: 4px solid var(--gold);
    outline-offset: 5px;
    border-radius: 12px;
    box-shadow: 0 0 16px 12px color-mix(in srgb, var(--gold-light) 70%, transparent);
  }
  .voice-muted {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 8px;
  }
  .muster-title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 22px;
    line-height: 1.2;
    color: var(--ink);
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
  }
  .tags .kit-tag {
    font-size: 15px;
    font-weight: 600;
    padding-top: 3px;
    padding-bottom: 3px;
  }
  /* Nothing to tie the tag to on the parchment: the punched hole stays, the cord goes. */
  .tags .kit-tag::after {
    display: none;
  }
  .tags .quest {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    --tag-tilt: 1deg;
  }
  .quest .kit-seal {
    --seal-size: 22px;
  }
  .tags .kit-prophecy {
    margin: 0;
    font-size: 15px;
  }
  .kit-note {
    margin: 0;
    font-weight: 600;
  }
  /* Éris's fight rule under the tags: one line where the parchment allows it. */
  .head .kit-note {
    padding-top: 6px;
    padding-bottom: 6px;
    font-size: 16px;
  }
  .head .kit-note::before {
    top: 10px;
  }
  .kit-note p {
    margin: 0 0 10px;
  }
  .sheet-fold {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .scan-photos {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }
  .scan-photo {
    width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid var(--parchment-edge);
    background: var(--battle-text-bg);
  }
  .rule {
    margin: 0;
    font-size: 18px;
    line-height: 1.45;
  }
  .grand {
    align-self: center;
    min-width: min(100%, 320px);
    min-height: 56px;
    font-size: 18px;
  }
  .waiting {
    align-self: center;
  }
  /* Plan Ruling R7: the start bar is the muster's foot, so the fade that says "more below" goes. */
  .muster.with-bar {
    -webkit-mask-image: none;
    mask-image: none;
  }
  .muster.with-bar::after {
    display: none;
  }
  .choices {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  /* Narrow (1024×768): a notch tighter, so Éris's fight (its rule and a quest tag more) fits too. */
  .muster:not(.wide) {
    gap: 8px;
    padding-top: 10px;
  }
  .muster:not(.wide) .head .kit-note {
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .muster:not(.wide) .head .kit-note::before {
    top: 8px;
  }
  .muster:not(.wide) :global(.voice-text) {
    font-size: 16px;
    line-height: 1.25;
  }
  .muster:not(.wide) .choices {
    gap: 8px;
  }
  .muster:not(.wide) .head {
    gap: 6px;
  }
  .muster.wide .choices {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
  }
  /* Spec §5: « Commencer la dictée » stays in view, sticky at the bottom of the parchment. */
  .start-bar {
    position: sticky;
    bottom: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin: 0 -20px;
    padding: 6px 20px 4px;
    background:
      linear-gradient(var(--battle-parchment-edge), var(--battle-parchment-edge)),
      var(--tex-parchment);
    box-shadow: 0 -8px 12px -10px rgba(60, 35, 10, 0.45);
  }
  .total {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px 10px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
  }
  .prophecy-bonus {
    font-size: 15px;
    padding: 2px 10px 2px 20px;
    --tag-tilt: -1deg;
  }
  .prophecy-bonus::before {
    left: 7px;
    top: calc(50% - 3px);
    width: 6px;
    height: 6px;
  }
  .prophecy-bonus::after {
    display: none;
  }
  .suggestion {
    margin: 0;
    font-size: 16px;
    font-style: italic;
    text-align: center;
  }
  .start-row {
    align-self: stretch;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .caption {
    margin: 0;
    align-self: center;
    max-width: 48em;
    font-size: 14px;
    color: var(--ink-soft);
    text-align: center;
  }
  .credits {
    font-size: 15px;
    font-style: italic;
    color: var(--ink-soft);
  }
  .bar-words {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  /* A phone in landscape (the compact stage, under 560 px tall): the bar is one slim row, the total
     and the suggestion on the left, the buttons on the right, so the choices keep most of the
     parchment. */
  @media (max-height: 559px) {
    .start-bar {
      flex-direction: row;
      align-items: center;
      gap: 12px;
      padding: 4px 20px;
    }
    .bar-words {
      flex: 1 1 auto;
      min-width: 0;
      align-items: flex-start;
      gap: 2px;
    }
    .total {
      justify-content: flex-start;
      gap: 2px 8px;
      font-size: 14px;
    }
    .prophecy-bonus {
      font-size: 12px;
    }
    .suggestion {
      font-size: 14px;
      text-align: left;
    }
    .start-row {
      flex: none;
      align-self: auto;
      flex-wrap: nowrap;
      gap: 6px;
    }
    .start-bar .kit-bronze {
      flex: none;
      min-width: 0;
      min-height: 48px;
      padding: 6px 12px;
      font-size: 14px;
    }
  }
  .aids-reminder {
    margin: 0;
    font-size: 16px;
    color: var(--ink-soft);
  }
  .resume {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    text-align: center;
  }
  .resume-sheet {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .resume-sheet .kit-ribbon {
    margin: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }
</style>
