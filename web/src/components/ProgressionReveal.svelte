<script lang="ts">
  // The post-session progression reveal (spec §3.6, plan Task 8): a short, joyful, staggered
  // sequence of cards above the results screen - XP, quests touched, a lieutenant neutralised
  // (permanent, spec ethics: nothing is ever lost), rewards not already shown, the dragon growing,
  // the weekly goal and a boss outcome. Every reward here was already known in advance (the quest
  // board / lieutenant page / boss screen showed it before the player committed) - this screen
  // only confirms it happened.
  import Reveal from './juice/Reveal.svelte';
  import Gauge from './juice/Gauge.svelte';
  import Medallion from './juice/Medallion.svelte';
  import Particles from './juice/Particles.svelte';
  import Dragon from './Dragon.svelte';
  import { ART } from '../lib/world/art';
  import { worldApi } from '../lib/world/api';
  import { campStore, loadCatalog, refreshCamp } from '../lib/world/campStore.svelte';
  import { stageLabel, validName } from '../lib/world/dragon';
  import { romanTier } from '../lib/world/quests';
  import { ApiError } from '../lib/api';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { reducedMotion } from '../lib/juice/motion';
  import type { DragonOut, Progression, RewardKind } from '../lib/world/types';
  import type { Profile } from '../lib/types';

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

  const FIXED_GLYPHS: Record<string, string> = {
    sandales_hermes: '👟',
    egide: '🛡️',
    foudre_zeus: '⚡',
    'decor:lanterne': '🏮',
    'decor:tapis': '🧶',
    'decor:bibliotheque': '📚',
    'decor:trophee': '🍎',
    'decor:fresque': '🎨',
  };

  const LIEUTENANT_GLYPHS: Record<string, string> = {
    hydre: '🐍',
    echo: '🔊',
    chimere: '🦁',
    protee: '🌊',
    sirenes: '🎶',
    lethe: '🌫️',
  };

  function glyphFor(id: string, kind: RewardKind): string {
    if (kind === 'relic') {
      const l = campStore.catalog?.lieutenants.find((x) => x.relic === id);
      return l?.glyph ?? FIXED_GLYPHS[id] ?? '❔';
    }
    return FIXED_GLYPHS[id] ?? '❔';
  }

  // XP card ------------------------------------------------------------------------------------
  const rankFloor = $derived(campStore.catalog?.ranks[progression.xp.rank_before - 1]?.xp ?? 0);
  const rankNextThreshold = $derived(campStore.catalog?.ranks[progression.xp.rank_before]?.xp ?? null);
  const gaugeMax = $derived(
    Math.max(1, (rankNextThreshold ?? Math.max(progression.xp.total_after, rankFloor + 1)) - rankFloor),
  );
  const rankedUp = $derived(progression.xp.rank_after > progression.xp.rank_before);

  // `rankFloor` needs the world catalog, which may still be loading (`loadCatalog()` above) when
  // this mounts - keep tracking it until the delayed "to" step below takes over, so a slow fetch
  // doesn't freeze the gauge at the wrong scale.
  let xpValue = $state(0);
  let xpAnimated = false;
  $effect(() => {
    if (!xpAnimated) xpValue = Math.max(0, progression.xp.total_before - rankFloor);
  });
  const bonusChips = $derived([{ reason: 'session', amount: progression.xp.session }, ...progression.xp.bonuses]);

  // Quest cards ----------------------------------------------------------------------------------
  function questLabel(q: Progression['quests'][number]): string {
    if (q.kind === 'boss') return `Combat contre ${names.eris ?? 'Éris'} (${romanTier(progression.boss?.tier ?? 1)})`;
    const name = names[q.target] ?? q.target;
    return q.kind === 'oracle' ? `Rouleau de l'Oracle : ${name}` : `Tenir ${name} en échec`;
  }

  function questBonus(q: Progression['quests'][number]): { xp: number | null; rewardName: string | null } {
    const bonus = progression.xp.bonuses.find((b) => b.reason === q.kind);
    const reward = q.reward_id ? progression.rewards.find((r) => r.id === q.reward_id) : undefined;
    return { xp: bonus?.amount ?? null, rewardName: reward?.name ?? null };
  }

  // Rewards not already shown by the quest cards (their own `reward_id`) or the neutralised cards
  // (every relic-kind reward always comes from a neutralisation this session).
  const shownRewardIds = $derived(
    new Set(progression.quests.filter((q) => q.completed && q.reward_id).map((q) => q.reward_id as string)),
  );
  const extraRewards = $derived(progression.rewards.filter((r) => r.kind !== 'relic' && !shownRewardIds.has(r.id)));

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

  // Boss card ------------------------------------------------------------------------------------
  const bossReward = $derived(progression.boss?.won ? (progression.rewards.find((r) => r.kind === 'gear') ?? null) : null);

  // Sound & particles: fire once, staggered to roughly track the cards' own Reveal delays. Sound
  // always plays (mute is the only gate, inside `playSfx`); particles render nothing under
  // reduced motion (handled inside `Particles` itself).
  let xpBurstTrigger = $state(0);
  let neutralisedTriggers = $state<number[]>(progression.neutralised.map(() => 0));
  let dragonSparkleTrigger = $state(0);
  let weeklyLaurelTrigger = $state(0);

  $effect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // The XP gauge itself animates shortly after mount, independent of the other cues.
    timers.push(
      setTimeout(() => {
        xpAnimated = true;
        xpValue = Math.max(0, progression.xp.total_after - rankFloor);
        if (rankedUp) {
          playSfx('chime');
          xpBurstTrigger += 1;
        }
      }, 150),
    );
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

<div class="reveal-stack">
  <Reveal delay={nextDelay()}>
    <div class="card reveal-card" data-testid="reveal-xp">
      <p class="headline">+{progression.xp.session} XP</p>
      <div class="gauge-wrap">
        <Gauge value={xpValue} max={gaugeMax} label={progression.xp.title_after} />
        {#if rankedUp}<Particles trigger={xpBurstTrigger} kind="burst" />{/if}
      </div>
      <div class="chips">
        {#each bonusChips as b, i (i)}
          <span class="chip">{BONUS_LABELS[b.reason] ?? b.reason} +{b.amount}</span>
        {/each}
      </div>
      {#if rankedUp}
        <p class="rank-up pop">Nouveau rang : {progression.xp.title_after}</p>
      {/if}
    </div>
  </Reveal>

  {#each progression.quests as q (q.id)}
    {@const bonus = questBonus(q)}
    <Reveal delay={nextDelay()}>
      <div class="card reveal-card" class:gold-frame={q.completed} data-testid="reveal-quest-{q.id}">
        <p class="title">{questLabel(q)}</p>
        <p class="progress-line">
          {q.counted ? 'Ce texte compte : ' : 'Ce texte ne compte pas cette fois : '}{q.progress} / {q.goal ?? '?'}
        </p>
        {#if q.completed}
          <p class="accomplished">Quête accomplie !</p>
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
      <div class="parchment reveal-card full" data-testid="reveal-neutralised-{key}">
        <img
          src={ART.lieutenants[key as keyof typeof ART.lieutenants] ?? ART.eris}
          alt={names[key] ?? key}
          class="lieutenant-art"
        />
        <div class="neutralised-body">
          <p class="title">{names[key] ?? key} — neutralisé !</p>
          <p>Sa ruse ne te piège plus : taux ≥ 80 % sur trois jours.</p>
          <Medallion glyph={LIEUTENANT_GLYPHS[key] ?? '❔'} kind="relic" size={56} />
        </div>
        <Particles trigger={neutralisedTriggers[i]} kind="burst" />
      </div>
    </Reveal>
  {/each}

  {#each extraRewards as r (r.id)}
    <Reveal delay={nextDelay()}>
      <div class="card reveal-card reward" data-testid="reveal-reward-{r.id}">
        <Medallion glyph={glyphFor(r.id, r.kind)} kind={r.kind} />
        <span class="name">{r.name}</span>
      </div>
    </Reveal>
  {/each}

  {#if dragonGrew}
    <Reveal delay={nextDelay()}>
      <div class="card reveal-card" data-testid="reveal-dragon">
        <Dragon
          stage={isHatchEvent && hatchPhase === 'egg' ? 'egg' : progression.dragon.stage_after}
          tint={dragon?.tint ?? 'bronze'}
          mood="happy"
          size={140}
          name={dragon?.name}
        />
        {#if isHatchEvent}
          <p class="title">L'œuf éclôt !</p>
        {:else}
          <p class="title">{dragon?.name ?? 'Ton dragon'} grandit : {stageLabel(progression.dragon.stage_after)}</p>
        {/if}
        <Particles trigger={dragonSparkleTrigger} kind="sparkle" />

        {#if progression.dragon.needs_name && !dragonNameSaved}
          <div class="name-form">
            <input data-testid="reveal-name-input" maxlength="20" lang="fr" autocapitalize="words" bind:value={dragonNameInput} />
            <button type="button" class="btn btn-primary" data-testid="reveal-name-save" disabled={savingDragonName} onclick={saveDragonName}>
              C'est son nom
            </button>
          </div>
          {#if dragonNameError}<p class="orange" role="alert">{dragonNameError}</p>{/if}
        {/if}
      </div>
    </Reveal>
  {/if}

  {#if progression.weekly.reached_now}
    <Reveal delay={nextDelay()}>
      <div class="card reveal-card" data-testid="reveal-weekly">
        <span class="laurels" aria-hidden="true">
          {#each Array.from({ length: progression.weekly.target }) as _, i (i)}<span class="leaf">🌿</span>{/each}
        </span>
        <p class="title">
          Objectif de la semaine atteint ! +{progression.xp.bonuses.find((b) => b.reason === 'weekly')?.amount ?? 40} XP
        </p>
        <Particles trigger={weeklyLaurelTrigger} kind="laurel" />
      </div>
    </Reveal>
  {/if}

  {#if progression.boss}
    <Reveal delay={nextDelay()}>
      {#if progression.boss.won}
        <div class="eris-panel reveal-card boss-result" data-testid="reveal-boss">
          <img src={ART.erisSmug} alt="" class="eris-art flipped" />
          <div>
            <p class="line">« Impossible ! Garde ta pomme, je reviendrai avec de nouvelles ruses. »</p>
            {#if bossReward}<p class="reward-line">{bossReward.name}</p>{/if}
          </div>
        </div>
      {:else}
        <div class="parchment reveal-card boss-result" data-testid="reveal-boss">
          <p class="line">« Éris s'enfuit avec la pomme… pour cette fois. Le combat reste ouvert, rien n'est perdu. »</p>
        </div>
      {/if}
    </Reveal>
  {/if}

  <Reveal delay={nextDelay()}>
    <button type="button" class="btn btn-primary continue-btn" data-testid="reveal-continue" onclick={onDone}>
      Voir la relecture
    </button>
  </Reveal>
</div>

<style>
  .reveal-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 24px;
  }
  .reveal-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
    padding: 18px;
  }
  .reveal-card.full {
    flex-direction: row;
    text-align: left;
    align-items: center;
    gap: 16px;
  }
  .gold-frame {
    border: 3px solid var(--gold);
  }
  .headline {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 24px;
    margin: 0;
  }
  .gauge-wrap {
    position: relative;
    width: 100%;
    max-width: 320px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }
  .chip {
    border: 1px solid var(--marble-dark);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 13px;
  }
  .rank-up {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--gold);
    margin: 0;
  }
  .title {
    font-family: var(--font-display);
    font-weight: 600;
    margin: 0;
  }
  .progress-line {
    margin: 0;
  }
  .accomplished {
    margin: 0;
    color: var(--gold);
    font-weight: 700;
  }
  .reward-line {
    margin: 0;
    font-weight: 600;
    color: var(--gold);
  }
  .lieutenant-art {
    width: 88px;
    height: 88px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .neutralised-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
  .reward .name {
    font-family: var(--font-display);
    font-weight: 600;
  }
  .name-form {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .name-form input {
    min-height: 48px;
    padding: 0 12px;
    border-radius: var(--radius);
    border: 1px solid var(--marble-dark);
    font-size: 16px;
  }
  .laurels {
    font-size: 24px;
    letter-spacing: 2px;
  }
  .boss-result {
    flex-direction: row;
    text-align: left;
    align-items: center;
    gap: 16px;
  }
  .eris-art {
    width: 96px;
    height: 96px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .eris-art.flipped {
    transform: scaleX(-1);
  }
  .line {
    margin: 0;
    font-style: italic;
  }
  .continue-btn {
    align-self: center;
  }
</style>
