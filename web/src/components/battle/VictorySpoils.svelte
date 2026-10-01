<script lang="ts">
  // The victory's spoils (spec §3.6, plan Task 8; UI4 Task 6 moved it onto the victory sheet, built
  // from kit objects): a short, joyful, staggered sequence - XP rising on the dragon's laurel, quests touched,
  // a lieutenant neutralised (permanent, spec ethics: nothing is ever lost), rewards not already
  // shown, the dragon growing, the weekly goal and a boss outcome. Every reward here was already
  // known in advance (the quest board / lieutenant page / boss screen showed it before the player
  // committed) - this only confirms it happened.
  import { untrack } from 'svelte';
  import Reveal from '../juice/Reveal.svelte';
  import Medallion from '../juice/Medallion.svelte';
  import Particles from '../juice/Particles.svelte';
  import Dragon from '../Dragon.svelte';
  import LaurelBar from '../ui/LaurelBar.svelte';
  import OverlayVoice from '../scene/OverlayVoice.svelte';
  import { questNotCounted, VICTORY } from '../../lib/battle/lines';
  import type { OpponentId } from '../../lib/battle/battle';
  import { ART, RELIC_OF } from '../../lib/world/art';
  import { worldApi } from '../../lib/world/api';
  import { campStore, loadCatalog, refreshCamp } from '../../lib/world/campStore.svelte';
  import { stageLabel, stageXp, validName, victoryGauge, victoryLaurel, type VictoryPhase } from '../../lib/world/dragon';
  import { lowerLeadingArticle, romanTier } from '../../lib/world/quests';
  import { agree } from '../../lib/world/eris';
  import { erisSays } from '../../lib/world/voices';
  import { ApiError } from '../../lib/api';
  import { playSfx, unlockAudio } from '../../lib/juice/sfx';
  import { reducedMotion } from '../../lib/juice/motion';
  import { keepFocusedFieldAboveKeyboard } from '../../lib/scene/keyboardField.svelte';
  import type { DragonOut, LieutenantKey, Progression } from '../../lib/world/types';
  import type { Profile } from '../../lib/types';

  let {
    progression,
    profile,
    dragon,
    names,
    onDone,
  }: { progression: Progression; profile: Profile; dragon: DragonOut | null; names: Record<string, string>; onDone: () => void } =
    $props();

  void loadCatalog();

  const BONUS_LABELS: Record<string, string> = {
    // Spec 2026-09-29 §4: the session's parts, then the existing bonuses.
    text: 'Texte',
    session: 'Texte',
    pace: 'Rythme',
    aids: 'Sans aides',
    prophecy: 'Prophétie',
    board: 'Quête',
    oracle: 'Oracle',
    boss: 'Éris vaincue',
    mastery: 'Ruse neutralisée',
    weekly: 'Objectif de la semaine',
  };
  const XP_PARTS = ['text', 'pace', 'aids', 'prophecy'] as const;

  // Boss card: the treasure Éris leaves behind, shown once, in her defeat's block.
  const bossReward = $derived(progression.boss?.won ? (progression.rewards.find((r) => r.kind === 'gear') ?? null) : null);

  /** Brings the boss's block into view as it is revealed (UI4 playability #4): the climax of the game
   *  never waits below the fold. */
  function revealInView(node: HTMLElement, delay: number) {
    // Once its Reveal has landed (its fade-up moves it while it plays), or after its full time.
    const reveal = node.closest('.reveal');
    let done = false;
    const bring = () => {
      if (done) return;
      done = true;
      node.scrollIntoView({ block: 'nearest', behavior: quick ? 'auto' : 'smooth' });
    };
    const onEnd = (e: Event) => {
      if (e.target === reveal) bring();
    };
    reveal?.addEventListener('animationend', onEnd);
    const id = setTimeout(bring, delay + 700);
    return {
      destroy: () => {
        clearTimeout(id);
        reveal?.removeEventListener('animationend', onEnd);
      },
    };
  }

  // XP card ------------------------------------------------------------------------------------
  // Spec 2026-09-29 dragon growth §2: one gauge, the dragon's. A stage change fills the OLD stage's
  // scale to its max first, then switches the gauge to the NEW stage's floor/next (the P1-2 two-part
  // logic, keyed on the stage): otherwise the laurel would read full and past its own max at the
  // moment the dragon grows. Derived from the catalogue's stage table, so a still-loading catalogue
  // (`loadCatalog()` above) updates it.
  const gauge = $derived(victoryGauge(progression, stageXp(campStore.catalog)));

  // Reduced motion (UI4 global constraints): the laurel jumps straight to its final value, on the new
  // stage's scale.
  const quick = reducedMotion();
  // Only the phase is state; what the laurel shows is read from the current gauge at every phase, so a
  // catalogue that arrives mid-animation rescales it (the filled old scale included).
  let gaugePhase = $state<VictoryPhase>(quick ? 'after' : 'start');
  const shown = $derived(victoryLaurel(gauge, gaugePhase));
  // The text's chip always; a bonus's chip when it paid something. A victory saved before the parts has
  // its one « Texte » chip, the whole session.
  const bonusChips = $derived.by(() => {
    const parts = progression.xp.parts;
    const session = parts
      ? XP_PARTS.filter((k) => k === 'text' || parts[k] > 0).map((k) => ({ reason: k, amount: parts[k] }))
      : [{ reason: 'session', amount: progression.xp.session }];
    return [...session, ...progression.xp.bonuses];
  });
  // UI4 playability #2: the headline is all she earned (the laurel's own move), the tags its breakdown.
  const xpEarned = $derived(
    Math.max(0, progression.xp.total_after - progression.xp.total_before) ||
      progression.xp.session + progression.xp.bonuses.reduce((sum, b) => sum + b.amount, 0),
  );

  // Quest cards ----------------------------------------------------------------------------------
  // Mirrors `questTitle()` in `./quests.ts` (the board/quest board/Oracle screens) - this reveal's
  // `Progression['quests']` entries carry a `number | null` goal instead of `QuestOut`'s `goal.tier`
  // object, so it cannot call that function directly, but it must lower a leading article the same
  // way ("Tenir l'Hydre en échec", not "Tenir L'Hydre en échec") (P1-1).
  function questLabel(q: Progression['quests'][number]): string {
    if (q.kind === 'boss') return `Combat contre ${names.eris ?? 'Éris'} (${romanTier(progression.boss?.tier ?? 1)})`;
    const name = names[q.target] ?? q.target;
    return q.kind === 'oracle' ? `Rouleau de l'Oracle\u202f: ${name}` : `Tenir ${lowerLeadingArticle(name)} en échec`;
  }

  function questBonus(q: Progression['quests'][number]): { xp: number | null; rewardName: string | null } {
    const bonus = progression.xp.bonuses.find((b) => b.reason === q.kind);
    // The boss's treasure is shown once, with Éris's defeat (UI4 playability #4).
    const reward = q.reward_id && q.reward_id !== bossReward?.id ? progression.rewards.find((r) => r.id === q.reward_id) : undefined;
    return { xp: bonus?.amount ?? null, rewardName: reward?.name ?? null };
  }

  // Screen-reader name for the neutralised card's relic medallion, which sits with no visible
  // name of its own next to it (the card's own title/line already name the lieutenant, not the
  // relic - review round 1 #2).
  function relicName(key: string): string {
    const id = RELIC_OF[key as LieutenantKey];
    return campStore.catalog?.rewards[id]?.name ?? `Relique de ${names[key] ?? key}`;
  }

  // Rewards not already shown by the quest cards (their own `reward_id`), the neutralised cards
  // (every relic-kind reward always comes from a neutralisation this session) or the boss block (its
  // treasure, shown once with Éris's defeat: UI4 playability #4).
  const shownRewardIds = $derived(
    new Set(progression.quests.filter((q) => q.completed && q.reward_id).map((q) => q.reward_id as string)),
  );
  const extraRewards = $derived(
    progression.rewards.filter((r) => r.kind !== 'relic' && !shownRewardIds.has(r.id) && r.id !== bossReward?.id),
  );

  // Dragon card ------------------------------------------------------------------------------------
  // One source of truth for "the dragon grew" (Task 4 review): the gauge's stages, so the laurel's
  // « Ton dragon grandit ! » and this card can never disagree.
  const dragonGrew = $derived(gauge.grew);
  const isHatchEvent = $derived(gauge.stages.before === 'egg' && dragonGrew);
  let hatchPhase = $state<'egg' | 'hatched'>('egg');

  let dragonNameInput = $state('');
  let dragonNameError = $state('');
  let dragonNameSaved = $state(false);
  let savingDragonName = $state(false);
  // iPad report 2026-09-28: her dragon's name line stays whole above the on-screen keyboard (the
  // stage folds, the sheet scrolls it into view).
  let nameForm = $state<HTMLDivElement | undefined>(undefined);
  keepFocusedFieldAboveKeyboard(() => nameForm);

  async function saveDragonName() {
    dragonNameError = '';
    if (!validName(dragonNameInput)) {
      dragonNameError = 'Un nom de 1 à 20 lettres.';
      return;
    }
    savingDragonName = true;
    try {
      await worldApi.patchDragon(profile.id, { name: dragonNameInput });
      dragonNameSaved = true;
      unlockAudio();
      playSfx('chime');
      await refreshCamp(profile.id);
    } catch (e) {
      dragonNameError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      savingDragonName = false;
    }
  }

  // Sound & particles: fire once, staggered to roughly track the cards' own Reveal delays. Sound
  // always plays (mute is the only gate, inside `playSfx`); particles render nothing under
  // reduced motion (handled inside `Particles` itself).
  let xpBurstTrigger = $state(0);
  // One trigger slot per lieutenant neutralised in this reveal, sized once from the progression
  // passed in on mount (this component doesn't re-run its reveal if `progression` changes later).
  let neutralisedTriggers = $state<number[]>(untrack(() => progression.neutralised.map(() => 0)));
  let dragonSparkleTrigger = $state(0);
  let weeklyLaurelTrigger = $state(0);

  $effect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // The XP gauge animates shortly after mount. A stage change fills the OLD scale to its max first,
    // then (after the burst) switches to the NEW stage's scale and animates to `total_after` on it.
    // Reduced motion: the value is already final (above); only the chime plays.
    if (quick) {
      if (untrack(() => gauge.grew)) playSfx('chime');
    } else {
      timers.push(
        setTimeout(() => {
          if (untrack(() => gauge.grew)) {
            gaugePhase = 'filled';
            playSfx('chime');
            xpBurstTrigger += 1;
            timers.push(setTimeout(() => (gaugePhase = 'after'), 400));
          } else {
            gaugePhase = 'after';
          }
        }, 150),
      );
    }
    let t = 350;
    progression.neutralised.forEach((_key, i) => {
      timers.push(
        setTimeout(() => {
          playSfx('growth');
          neutralisedTriggers[i] += 1;
        }, t),
      );
      t += 300;
    });
    if (untrack(() => dragonGrew)) {
      const at = t;
      timers.push(
        setTimeout(() => {
          playSfx('growth');
          dragonSparkleTrigger += 1;
        }, at),
      );
      t += 300;
    }
    if (progression.weekly.reached_now) {
      const at = t;
      timers.push(
        setTimeout(() => {
          playSfx('laurel');
          weeklyLaurelTrigger += 1;
        }, at),
      );
      t += 300;
    }
    // Éris's « hmpf » is her mocking a real loss.
    if (progression.boss && !progression.boss.won) {
      const at = t;
      timers.push(setTimeout(() => playSfx('hmpf'), at));
    }
    return () => timers.forEach(clearTimeout);
  });

  $effect(() => {
    if (!isHatchEvent) return;
    if (reducedMotion()) {
      hatchPhase = 'hatched';
      return;
    }
    const id = setTimeout(() => (hatchPhase = 'hatched'), 550);
    return () => clearTimeout(id);
  });

  let delayIndex = 0;
  function nextDelay(): number {
    const d = delayIndex * 250;
    delayIndex += 1;
    return d;
  }
</script>

<div class="spoils">
  <Reveal delay={nextDelay()}>
    <div class="spoil xp" data-testid="reveal-xp">
      <p class="xp-gain" data-testid="reveal-xp-gain">{VICTORY.xpGain(xpEarned)}</p>
      <div class="xp-laurel">
        <LaurelBar
          value={shown.value}
          max={shown.max}
          label={shown.label}
          testId="victory-xp"
          surface="parchment"
          note={shown.grewNote ? VICTORY.stageUp : undefined}
        />
        {#if gauge.grew}<Particles trigger={xpBurstTrigger} kind="burst" />{/if}
      </div>
      <div class="bonuses">
        {#each bonusChips as b, i (i)}
          <span class="kit-tag bonus" data-testid="xp-chip" style:--tag-tilt="{i % 2 ? 1.2 : -1.2}deg">{BONUS_LABELS[b.reason] ?? b.reason} +{b.amount}</span>
        {/each}
      </div>
    </div>
  </Reveal>

  {#each progression.quests as q (q.id)}
    {@const bonus = questBonus(q)}
    <Reveal delay={nextDelay()}>
      <div class="kit-sheet spoil" class:is-complete={q.completed} data-testid="reveal-quest-{q.id}">
        <p class="spoil-title">{questLabel(q)}</p>
        {#if !q.counted && q.reason}
          <!-- Final review minor 9: why it does not count, in the camp's voice. -->
          <p data-testid="quest-reason">{questNotCounted(q.reason, q.target as OpponentId)}</p>
          <p>Ta quête{'\u202f: '}{q.progress} / {q.goal ?? '?'}</p>
        {:else}
          <p>
            {q.counted ? 'Ce texte compte\u202f: ' : 'Ce texte ne compte pas cette fois\u202f: '}{q.progress} / {q.goal ?? '?'}
          </p>
        {/if}
        {#if q.completed}
          <p class="kit-stamp accomplished">Quête accomplie{'\u202f!'}</p>
          {#if bonus.xp !== null || bonus.rewardName}
            <p class="reward-line">
              {[bonus.xp !== null ? `${bonus.xp} XP` : null, bonus.rewardName].filter(Boolean).join(' · ')}
            </p>
          {/if}
        {/if}
      </div>
    </Reveal>
  {/each}

  {#each progression.neutralised as key, i (key)}
    <Reveal delay={nextDelay()}>
      <div class="neutralised" data-testid="reveal-neutralised-{key}">
        <img
          src={ART.lieutenants[key as keyof typeof ART.lieutenants] ?? ART.eris}
          alt={names[key] ?? key}
          class="lieutenant-art"
        />
        <div class="kit-sheet spoil neutralised-sheet">
          <p class="spoil-title">{names[key] ?? key} — {agree('neutralisé', key as LieutenantKey)}{'\u202f!'}</p>
          <p>{VICTORY.neutralised}</p>
          <Medallion rewardId={RELIC_OF[key as LieutenantKey] ?? ''} size={56} label={relicName(key)} />
        </div>
        <Particles trigger={neutralisedTriggers[i]} kind="burst" />
      </div>
    </Reveal>
  {/each}

  {#each extraRewards as r (r.id)}
    <Reveal delay={nextDelay()}>
      <div class="kit-sheet spoil treasure" data-testid="reveal-reward-{r.id}">
        <Medallion rewardId={r.id} size={64} />
        <p class="spoil-title">{VICTORY.treasure(r.name)}</p>
      </div>
    </Reveal>
  {/each}

  {#if dragonGrew}
    <Reveal delay={nextDelay()}>
      <div class="kit-sheet spoil" data-testid="reveal-dragon">
        <Dragon
          stage={isHatchEvent && hatchPhase === 'egg' ? 'egg' : gauge.stages.after}
          tint={dragon?.tint ?? 'bronze'}
          mood="happy"
          size={140}
          name={dragon?.name}
        />
        {#if isHatchEvent}
          <p class="spoil-title">L'œuf éclôt{'\u202f!'}</p>
        {:else}
          <p class="spoil-title">{dragon?.name ?? 'Ton dragon'} grandit{'\u202f: '}{stageLabel(gauge.stages.after)}</p>
        {/if}
        <Particles trigger={dragonSparkleTrigger} kind="sparkle" />

        {#if progression.dragon.needs_name && !dragonNameSaved}
          <!-- UI4 playability #9: a question, and her answer inked on the parchment's line. -->
          <p class="name-ask" id="reveal-name-ask">{VICTORY.nameAsk}</p>
          <!-- Not a kit-form field: her dragon's name is written on the parchment's line. -->
          <div class="name-form" bind:this={nameForm}>
            <input
              data-testid="reveal-name-input"
              aria-label={VICTORY.dragonName}
              aria-describedby="reveal-name-ask"
              placeholder={VICTORY.namePlaceholder}
              maxlength="20"
              lang="fr"
              autocapitalize="words"
              autocorrect="off"
              spellcheck="false"
              bind:value={dragonNameInput}
            />
            <button type="button" class="kit-bronze" data-testid="reveal-name-save" disabled={savingDragonName} onclick={saveDragonName}>
              {VICTORY.nameSave}
            </button>
          </div>
          {#if dragonNameError}<p class="kit-note" data-tone="eris" role="alert">{dragonNameError}</p>{/if}
        {/if}
      </div>
    </Reveal>
  {/if}

  {#if progression.weekly.reached_now}
    <Reveal delay={nextDelay()}>
      <div class="kit-sheet spoil" data-testid="reveal-weekly">
        <span class="laurels" aria-hidden="true">
          {#each Array.from({ length: progression.weekly.target }) as _, i (i)}<span class="leaf"></span>{/each}
        </span>
        <p class="spoil-title">
          Objectif de la semaine atteint{'\u202f!'} +{progression.xp.bonuses.find((b) => b.reason === 'weekly')?.amount ?? 40} XP
        </p>
        <Particles trigger={weeklyLaurelTrigger} kind="laurel" />
      </div>
    </Reveal>
  {/if}

  {#if progression.boss}
    {@const bossDelay = nextDelay()}
    <Reveal delay={bossDelay}>
      {#if progression.boss.won}
        <!-- UI4 playability #4: Éris's defeat line, then her treasure, once, on a sheet of its own. -->
        <div class="kit-sheet spoil boss-won" data-testid="reveal-boss" use:revealInView={bossDelay}>
          <OverlayVoice line={erisSays(VICTORY.bossWon)} testId="boss-voice" />
          {#if bossReward}
            <Medallion rewardId={bossReward.id} size={72} />
            <p class="spoil-title boss-reward" data-testid="reveal-boss-reward">{VICTORY.bossReward(bossReward.name)}</p>
          {/if}
        </div>
      {:else}
        <!-- Her exit is her own voice (UI4 playability #10), not a note. -->
        <div class="boss-lost" data-testid="reveal-boss" use:revealInView={bossDelay}>
          <OverlayVoice line={erisSays(VICTORY.bossLost)} testId="boss-voice" />
        </div>
      {/if}
    </Reveal>
  {/if}

  <Reveal delay={nextDelay()}>
    <div class="continue">
      <button type="button" class="kit-bronze" data-testid="reveal-continue" onclick={onDone}>{VICTORY.continue}</button>
    </div>
  </Reveal>
</div>

<style>
  .spoils {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .spoil {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }
  .spoil p {
    margin: 0;
  }
  /* A quest accomplished: the sheet's gold rim. */
  .kit-sheet.is-complete {
    box-shadow:
      0 0 0 3px var(--gold),
      0 6px 16px rgba(0, 0, 0, 0.35);
  }
  .xp-gain {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 26px;
    color: var(--reward-ink);
  }
  .xp-laurel {
    position: relative;
  }
  /* The bonuses hang as paper tags, their cords tucked under the laurel above. */
  .bonuses {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 14px;
    justify-content: center;
    padding-top: 10px;
  }
  .bonus {
    font-size: 15px;
    font-weight: 600;
    padding: 4px 10px 5px 24px;
  }
  .spoil-title {
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--bronze-dark);
  }
  .accomplished {
    align-self: center;
    font-size: 13px;
    color: var(--reward-ink);
  }
  .reward-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 700;
    color: var(--reward-ink);
  }
  .neutralised {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .neutralised-sheet {
    flex: 1;
  }
  .lieutenant-art {
    width: 96px;
    height: 96px;
    object-fit: contain;
    flex-shrink: 0;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35));
  }
  /* A treasure (UI4 playability #4): a sheet of the scroll with its medallion, never the shelves'
     dark cubby. */
  .treasure .spoil-title,
  .boss-reward {
    color: var(--reward-ink);
    font-size: 20px;
  }
  .boss-won :global(.overlay-voice) {
    align-self: stretch;
    margin: 0;
    text-align: left;
  }
  .boss-lost :global(.overlay-voice) {
    margin: 0;
  }
  .name-ask {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    color: var(--ink);
  }
  .name-form {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
  }
  /* Her dragon's name, inked on the parchment's line (UI4 playability #9). */
  .name-form input {
    width: 12em;
    min-height: 48px;
    padding: 4px 8px;
    background: transparent;
    border: 0;
    border-bottom: 2px solid var(--bronze);
    border-radius: 0;
    box-shadow: none;
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 22px;
    text-align: center;
  }
  .name-form input::placeholder {
    color: var(--ink-soft);
    font-style: italic;
  }
  .name-form input:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .laurels {
    display: inline-flex;
    gap: 4px;
  }
  /* Same CSS-only leaf as the camp's weekly ribbon (UI3 Ruling A12: no emoji): every leaf is gold,
     this sheet only shows once the goal is reached. */
  .leaf {
    width: 12px;
    height: 19px;
    box-sizing: border-box;
    border-radius: 100% 0;
    border: 1px solid var(--bronze-dark);
    transform: rotate(-30deg);
    background: linear-gradient(135deg, var(--gold-light), var(--gold));
  }
  .continue {
    display: flex;
    justify-content: center;
  }
</style>
