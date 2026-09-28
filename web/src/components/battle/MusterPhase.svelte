<script lang="ts">
  // The muster (UI4 Task 3): the order of battle on the parchment before the fight. The resume
  // ribbon when a dictation or a proofreading waits; otherwise the text's title, its length in
  // words (no grade code, no « ≈ », Ruling C8), the quest, boss and prophecy ribbons, Éris's taunt
  // on her voice plate (Ruling C7), the sheet fold, then the pace medallions and « Commencer la
  // dictée » - or, for the grimoire, Éris's rule and « Ouvrir le grimoire ».
  import { untrack } from 'svelte';
  import OverlayVoice from '../scene/OverlayVoice.svelte';
  import PaceMedallions from './PaceMedallions.svelte';
  import { api } from '../../lib/api';
  import { audioSettings, setChannel } from '../../lib/audio/store.svelte';
  import { MUSTER } from '../../lib/battle/lines';
  import { battleStage, react } from '../../lib/battle/stage.svelte';
  import { isProphecy } from '../../lib/dates';
  import { PACE_LABELS, type Pace } from '../../lib/dictation/script';
  import type { PlayState } from '../../lib/playState';
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
    questId,
    encounter,
    resume,
    corrupting,
    corruptError,
    taunt,
    profileId,
    onContinue,
    onRestart,
    onStart,
    onOpenGrimoire,
    onToLibrary,
  }: {
    text: TextFull;
    mode: PlayMode;
    /** Bound for the pace choice. */
    playState: PlayState;
    minPace: Pace;
    questId: number | null;
    encounter: string | null;
    /** A saved dictation or proofreading waits: the resume ribbon instead of the order of battle. */
    resume: boolean;
    corrupting: boolean;
    corruptError: string | null;
    /** Éris's line at the muster (Ruling C7), on her voice plate. */
    taunt: DialogueLine | null;
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

  // « Continuer » resumes a saved dictation at its saved pace, so the ribbon names it (pace-bug report
  // 2026-09-27, open item 1); « Recommencer » is the way to another. A grimoire has no pace.
  const continueLabel = $derived(mode === 'dictation' ? MUSTER.continueAt(PACE_LABELS[playState.pace].title) : MUSTER.continue);

  function credits(t: TextFull): string {
    if (t.credits) return t.credits;
    if (t.source === 'custom' && t.added_by_name) return `Ajouté par ${t.added_by_name}`;
    return '';
  }

  // The two sides square up: the opponent taunts, the dragon braces (Ruling C10). Again for each new
  // battle on this muster (« Recommencer » resets the stage under it, final review I2).
  $effect(() => {
    void battleStage.generation;
    untrack(() => {
      react('opponent', 'taunt');
      react('dragon', 'brace');
    });
  });
</script>

<div class="muster" class:short={mode === 'grimoire' && !resume}>
  {#if resume}
    <div class="resume">
      <h2 class="muster-title">{text.title}</h2>
      <div class="resume-sheet" data-testid="battle-resume">
        <p class="kit-ribbon">{MUSTER.resume}</p>
        <div class="actions">
          <button type="button" class="kit-bronze" data-testid="battle-resume-continue" onclick={onContinue}>{continueLabel}</button>
          <button type="button" class="kit-bronze is-quiet" data-testid="battle-resume-restart" onclick={onRestart}>{MUSTER.restart}</button>
        </div>
      </div>
    </div>
  {:else}
    <header class="head">
      <h2 class="muster-title">{mode === 'grimoire' ? MUSTER.grimoire : text.title}</h2>
      {#if credits(text)}<p class="credits">{credits(text)}</p>{/if}
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
      </div>
      {#if encounter === 'eris'}
        <p class="kit-note" data-tone="eris" data-testid="play-boss-banner">{MUSTER.boss}</p>
      {/if}
    </header>

    {#if taunt}<OverlayVoice line={taunt} testId="battle-voice" />{/if}

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
    {:else}
      <PaceMedallions bind:pace={playState.pace} {minPace} />
      <p class="glory">{MUSTER.paceGlory}</p>
      <button type="button" class="kit-bronze grand" onclick={onStart}>{MUSTER.start}</button>

      <!-- UI4 playability #8: the fight against Éris has one way in and no side door; a lieutenant's
           grimoire keeps its encounter, so it is still that lieutenant's battle. -->
      {#if encounter !== 'eris'}
        <div class="grimoire-way">
          <button
            type="button"
            class="kit-bronze is-quiet"
            data-testid="btn-grimoire"
            onclick={() => go(href('grimoire', { profileId: String(profileId), textId: String(text.id) }, grimoireQuery))}
          >
            {MUSTER.grimoire}
          </button>
          <p class="caption">{MUSTER.grimoireCaption}</p>
        </div>
      {/if}
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
    gap: 14px;
    padding: 18px 22px;
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
  .muster :global(.overlay-voice) {
    margin: 0;
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
    font-size: 26px;
    line-height: 1.2;
    color: var(--ink);
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .credits {
    margin: -4px 0 0;
    font-size: 16px;
    font-style: italic;
    color: var(--ink-soft);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
  }
  .tags .kit-tag {
    font-size: 17px;
    font-weight: 600;
    padding-top: 6px;
    padding-bottom: 6px;
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
    --seal-size: 28px;
  }
  .tags .kit-prophecy {
    margin: 0;
    font-size: 16px;
  }
  .kit-note {
    margin: 0;
    font-weight: 600;
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
  .glory {
    margin: 0;
    font-size: 16px;
    font-style: italic;
    color: var(--ink-soft);
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
  .grimoire-way {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    padding-top: 16px;
    border-top: 1px solid rgba(138, 90, 40, 0.45);
    text-align: center;
  }
  .caption {
    margin: 0;
    max-width: 34em;
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
