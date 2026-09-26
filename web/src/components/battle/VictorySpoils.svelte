<script lang="ts">
  // The victory's spoils (spec §3.6, plan Task 8; UI4 Task 6 moved it onto the victory sheet, built
  // from kit objects): a short, joyful, staggered sequence - XP rising on the laurel, quests touched,
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
  import { VICTORY } from '../../lib/battle/lines';
  import { ART, RELIC_OF } from '../../lib/world/art';
  import { worldApi } from '../../lib/world/api';
  import { campStore, loadCatalog, refreshCamp } from '../../lib/world/campStore.svelte';
  import { stageLabel, validName } from '../../lib/world/dragon';
  import { lowerLeadingArticle, romanTier } from '../../lib/world/quests';
  import { agree } from '../../lib/world/eris';
  import { erisSays } from '../../lib/world/voices';
  import { ApiError } from '../../lib/api';
  import { playSfx, unlockAudio } from '../../lib/juice/sfx';
  import { reducedMotion } from '../../lib/juice/motion';
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
    session: 'Texte',
    board: 'Quête',
    oracle: 'Oracle',
    boss: 'Éris vaincue',
    mastery: 'Ruse neutralisée',
    weekly: 'Objectif de la semaine',
  };

  // Boss card: the treasure Éris leaves behind, shown once, in her defeat's block.
  const bossReward = $derived(progression.boss?.won ? (progression.rewards.find((r) => r.kind === 'gear') ?? null) : null);

  /** Brings the boss's block into view as it is revealed (UI4 playability #4): the climax of the game
   *  never waits below the fold. */
  function revealInView(node: HTMLElement, delay: number) {
    const id = setTimeout(() => node.scrollIntoView({ block: 'nearest', behavior: quick ? 'auto' : 'smooth' }), delay + 200);
    return { destroy: () => clearTimeout(id) };
  }

  // XP card ------------------------------------------------------------------------------------
  // A rank-up (`rank_after > rank_before`) must animate the OLD rank's scale to its own max first,
  // then switch the gauge to the NEW rank's floor/next thresholds (P1-2): otherwise the bar reads
  // "Sentinelle des textes 441 / 250" - full and past its own max at the exact moment the game
  // says "Nouveau rang". `rankBefore*`/`rankAfter*` are kept as separate derived values (not one
  // mutated in place) so both stay reactive to a still-loading world catalog the whole time.
  const rankBeforeFloor = $derived(campStore.catalog?.ranks[progression.xp.rank_before - 1]?.xp ?? 0);
  const rankBeforeNextThreshold = $derived(campStore.catalog?.ranks[progression.xp.rank_before]?.xp ?? null);
  const rankBeforeMax = $derived(
    Math.max(1, (rankBeforeNextThreshold ?? Math.max(progression.xp.total_before, rankBeforeFloor + 1)) - rankBeforeFloor),
  );
  const rankBeforeTitle = $derived(campStore.catalog?.ranks[progression.xp.rank_before - 1]?.title ?? progression.xp.title_after);

  const rankAfterFloor = $derived(campStore.catalog?.ranks[progression.xp.rank_after - 1]?.xp ?? 0);
  const rankAfterNextThreshold = $derived(campStore.catalog?.ranks[progression.xp.rank_after]?.xp ?? null);
  const rankAfterMax = $derived(
    Math.max(1, (rankAfterNextThreshold ?? Math.max(progression.xp.total_after, rankAfterFloor + 1)) - rankAfterFloor),
  );

  const rankedUp = $derived(progression.xp.rank_after > progression.xp.rank_before);

  // Reduced motion (UI4 global constraints): the laurel jumps straight to its final value, on the
  // new rank's scale.
  const quick = reducedMotion();
  // Which scale the gauge currently shows: the old one until the rank-up switch fires (below),
  // the new one immediately when there is no rank-up at all.
  let gaugePhase = $state<'before' | 'after'>(quick ? 'after' : 'before');
  const showingAfterRank = $derived(!rankedUp || gaugePhase === 'after');
  const gaugeFloor = $derived(showingAfterRank ? rankAfterFloor : rankBeforeFloor);
  const gaugeMax = $derived(showingAfterRank ? rankAfterMax : rankBeforeMax);
  const gaugeTitle = $derived(showingAfterRank ? progression.xp.title_after : rankBeforeTitle);

  // `gaugeFloor` needs the world catalog, which may still be loading (`loadCatalog()` above) when
  // this mounts - keep tracking it until the delayed "to" step below takes over, so a slow fetch
  // doesn't freeze the gauge at the wrong scale.
  let xpValue = $state(0);
  let xpAnimated = false;
  $effect(() => {
    if (!xpAnimated) {
      xpValue = quick ? Math.max(0, progression.xp.total_after - rankAfterFloor) : Math.max(0, progression.xp.total_before - gaugeFloor);
    }
  });
  const bonusChips = $derived([{ reason: 'session', amount: progression.xp.session }, ...progression.xp.bonuses]);
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
    return q.kind === 'oracle' ? `Rouleau de l'Oracle : ${name}` : `Tenir ${lowerLeadingArticle(name)} en échec`;
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
  const dragonGrew = $derived(progression.dragon.stage_before !== progression.dragon.stage_after);
  const isHatchEvent = $derived(progression.dragon.stage_before === 'egg' && dragonGrew);
  let hatchPhase = $state<'egg' | 'hatched'>('egg');

  let dragonNameInput = $state('');
  let dragonNameError = $state('');
  let dragonNameSaved = $state(false);
  let savingDragonName = $state(false);

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
    // The XP gauge itself animates shortly after mount, independent of the other cues. A rank-up
    // fills the OLD scale to its max first, then (after the burst) switches the gauge to the NEW
    // rank's floor/next and animates to `total_after` on that scale (P1-2). Reduced motion: the value
    // is already final (above); only the rank-up chime plays.
    if (quick) {
      if (untrack(() => rankedUp)) playSfx('chime');
    } else {
      timers.push(
        setTimeout(() => {
          xpAnimated = true;
          if (rankedUp) {
            xpValue = rankBeforeMax;
            playSfx('chime');
            xpBurstTrigger += 1;
            timers.push(
              setTimeout(() => {
                gaugePhase = 'after';
                xpValue = Math.max(0, progression.xp.total_after - rankAfterFloor);
              }, 400),
            );
          } else {
            xpValue = Math.max(0, progression.xp.total_after - rankAfterFloor);
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
    if (dragonGrew) {
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
    // Éris's "hmpf" is her mocking a real loss - it doesn't fit a fight she never got to fight
    // (P1-5's 'too_easy' draw), so it only plays on an actual loss.
    if (progression.boss && !progression.boss.won && !progression.boss.too_easy) {
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
          value={xpValue}
          max={gaugeMax}
          label={gaugeTitle}
          testId="victory-xp"
          surface="parchment"
          note={rankedUp && showingAfterRank ? VICTORY.rankFresh : undefined}
        />
        {#if rankedUp}<Particles trigger={xpBurstTrigger} kind="burst" />{/if}
      </div>
      <div class="bonuses">
        {#each bonusChips as b, i (i)}
          <span class="kit-tag bonus" style:--tag-tilt="{i % 2 ? 1.2 : -1.2}deg">{BONUS_LABELS[b.reason] ?? b.reason} +{b.amount}</span>
        {/each}
      </div>
      {#if rankedUp}
        <p class="kit-ribbon rank-up">Nouveau rang : {progression.xp.title_after}</p>
      {/if}
    </div>
  </Reveal>

  {#each progression.quests as q (q.id)}
    {@const bonus = questBonus(q)}
    <Reveal delay={nextDelay()}>
      <div class="kit-sheet spoil" class:is-complete={q.completed} data-testid="reveal-quest-{q.id}">
        <p class="spoil-title">{questLabel(q)}</p>
        <p>
          {q.counted ? 'Ce texte compte : ' : 'Ce texte ne compte pas cette fois : '}{q.progress} / {q.goal ?? '?'}
        </p>
        {#if q.completed}
          <p class="kit-stamp accomplished">Quête accomplie !</p>
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
          <p class="spoil-title">{names[key] ?? key} — {agree('neutralisé', key as LieutenantKey)} !</p>
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
          stage={isHatchEvent && hatchPhase === 'egg' ? 'egg' : progression.dragon.stage_after}
          tint={dragon?.tint ?? 'bronze'}
          mood="happy"
          size={140}
          name={dragon?.name}
        />
        {#if isHatchEvent}
          <p class="spoil-title">L'œuf éclôt !</p>
        {:else}
          <p class="spoil-title">{dragon?.name ?? 'Ton dragon'} grandit : {stageLabel(progression.dragon.stage_after)}</p>
        {/if}
        <Particles trigger={dragonSparkleTrigger} kind="sparkle" />

        {#if progression.dragon.needs_name && !dragonNameSaved}
          <!-- UI4 playability #9: a question, and her answer inked on the parchment's line. -->
          <p class="name-ask" id="reveal-name-ask">{VICTORY.nameAsk}</p>
          <!-- Not a kit-form field: her dragon's name is written on the parchment's line. -->
          <div class="name-form">
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
          Objectif de la semaine atteint ! +{progression.xp.bonuses.find((b) => b.reason === 'weekly')?.amount ?? 40} XP
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
      {:else if progression.boss.too_easy}
        <p class="kit-note" data-testid="reveal-boss-too-easy">{VICTORY.bossTooEasy}</p>
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
  .rank-up {
    font-size: 17px;
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
