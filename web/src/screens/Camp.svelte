<script lang="ts">
  // The camp: the new home after picking a profile (spec §2 "the camp is the hub"). Aggregates
  // the world API's /camp response; degrades gracefully (friendly French message, no crash) while
  // the server-side world endpoints (SP3 Tasks 2-3) aren't merged yet - the essential exit hatch
  // (the "Les Parchemins" card) stays reachable even then, since it doesn't need camp data.
  import TopBar from '../components/TopBar.svelte';
  import Onboarding from '../components/Onboarding.svelte';
  import Dragon from '../components/Dragon.svelte';
  import Gauge from '../components/juice/Gauge.svelte';
  import { ART } from '../lib/world/art';
  import { worldApi } from '../lib/world/api';
  import { campStore, refreshCamp } from '../lib/world/campStore.svelte';
  import { stageLine } from '../lib/world/dragon';
  import type { WorldCatalog } from '../lib/world/types';
  import { initSound } from '../lib/juice/soundStore.svelte';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { formatSwissDate } from '../lib/dates';
  import { href, type RouteName } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  // Not fetched through campStore: only needed here to name the boss reward "known in advance"
  // (decision 9/12). Best-effort - if it fails, the boss panel just skips the reward name.
  let world = $state<WorldCatalog | null>(null);

  $effect(() => {
    initSound(profile);
    void refreshCamp(profile.id);
    worldApi
      .world()
      .then((w) => (world = w))
      .catch(() => {
        // Non-critical - the boss panel falls back to a generic phrase.
      });
  });

  function go(name: RouteName) {
    unlockAudio();
    playSfx('tap');
    navigate(href(name, { profileId: String(profile.id) }));
  }

  function retry() {
    void refreshCamp(profile.id);
  }

  const dragonSpeech = $derived.by(() => {
    const d = campStore.data?.dragon;
    if (!d) return '';
    const remaining = Math.max(0, d.available - d.neutralised);
    return stageLine(d.stage, d.name, remaining);
  });

  const nearestProphecy = $derived.by(() => {
    const list = campStore.data?.prophecies ?? [];
    if (list.length === 0) return null;
    return [...list].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  });

  const activeBossQuest = $derived(campStore.data?.quests.find((q) => q.kind === 'boss' && q.status === 'active') ?? null);

  function bossRewardName(): string {
    const tier = campStore.data?.boss.tier_available;
    if (tier === null || tier === undefined) return 'une récompense';
    const rewardId = world?.boss_rewards[String(tier)];
    const name = rewardId ? world?.rewards[rewardId]?.name : undefined;
    return name ?? 'une récompense';
  }

  const activeQuestsCount = $derived(campStore.data?.quests.filter((q) => q.status === 'active').length ?? 0);
  const neutralisedCount = $derived(campStore.data?.lieutenants.filter((l) => l.neutralised).length ?? 0);
  const availableLieutenantsCount = $derived(campStore.data?.lieutenants.filter((l) => l.available).length ?? 0);
</script>

<TopBar {profile} title="Le camp" />

{#if !profile.settings.onboarded}
  <Onboarding {profile} />
{/if}

<div class="screen camp">
  <div class="scene" style="background-image:url({ART.scenes.camp})">
    <h1>Bienvenue au camp, {profile.name}.</h1>
    {#if campStore.data}
      <!-- P1-6: the scene's scrim (app.css `.scene::after`) fades to transparent well above this
           block, so the rank line, the gauge and the weekly leaves sat directly on the busy
           painting. A solid parchment panel behind them guarantees contrast regardless of what's
           underneath (the palette's own marble tone, not a new colour). -->
      <div class="hud-panel">
        <p class="xp-line" data-testid="camp-xp">{campStore.data.xp.title} · {campStore.data.xp.total} XP</p>
        {#if campStore.data.xp.next_threshold !== null}
          <Gauge
            value={campStore.data.xp.total - campStore.data.xp.rank_floor}
            max={campStore.data.xp.next_threshold - campStore.data.xp.rank_floor}
            label={campStore.data.xp.title}
          />
        {:else}
          <p class="muted">Rang maximal</p>
        {/if}
        <p class="weekly" data-testid="camp-weekly">
          <span class="leaves" aria-hidden="true">
            {#each Array.from({ length: campStore.data.weekly.target }) as _, i (i)}<span
                class="leaf"
                class:filled={i < campStore.data.weekly.done}>🌿</span
              >{/each}
          </span>
          <span class="weekly-caption">
            {#if campStore.data.weekly.reached}
              Objectif atteint ! Les Muses sont fières.
            {:else}
              Objectif de la semaine : {campStore.data.weekly.done} / {campStore.data.weekly.target} textes
            {/if}
          </span>
        </p>
      </div>
    {/if}
  </div>

  {#if campStore.loading && !campStore.data}
    <p class="muted status-line">Les Muses préparent le camp…</p>
  {:else if campStore.error}
    <p class="orange status-line">Impossible de rejoindre le camp : {campStore.error}</p>
    <button type="button" class="btn" onclick={retry}>Réessayer</button>
  {/if}

  {#if campStore.data}
    <button type="button" class="card dragon-card" data-testid="camp-dragon" onclick={() => go('dragon')}>
      <span class="dragon-art">
        <Dragon
          stage={campStore.data.dragon.stage}
          tint={campStore.data.dragon.tint}
          size={84}
          mood="idle"
          name={campStore.data.dragon.name}
        />
      </span>
      <span class="dragon-bubble">
        <span class="dragon-name">{campStore.data.dragon.name ?? 'Un œuf de dragon'}</span>
        <span class="dragon-line">{dragonSpeech}</span>
      </span>
    </button>

    {#if nearestProphecy}
      <div class="parchment banner-prophecy" data-testid="camp-prophecy">
        <p>
          Prophétie de l'Oracle : {nearestProphecy.title} — dictée le {formatSwissDate(nearestProphecy.due_date)}
          ({nearestProphecy.days_left === 0 ? "aujourd'hui" : `dans ${nearestProphecy.days_left} jour(s)`})
        </p>
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => navigate(href('play', { profileId: String(profile.id), textId: String(nearestProphecy!.text_id) }))}
        >
          Réviser
        </button>
      </div>
    {/if}

    {#if campStore.data.boss.tier_available !== null || campStore.data.boss.active_quest_id !== null}
      <button type="button" class="eris-panel banner-boss" data-testid="camp-boss" onclick={() => go('boss')}>
        <img src={ART.erisSmug} alt="" class="boss-art" />
        <span class="boss-text">
          <span class="boss-title">Éris t'attend au bord du camp.</span>
          <span class="boss-line">
            {#if activeBossQuest}
              Un combat est déjà engagé contre Éris.
            {:else}
              Combat {campStore.data.boss.tier_available} : {bossRewardName()}
            {/if}
          </span>
        </span>
      </button>
    {/if}
  {/if}

  <div class="grid">
    <button type="button" class="card" data-testid="camp-parchemins" onclick={() => go('library')}>
      <span class="card-glyph" aria-hidden="true">📜</span>
      <span class="card-title">Les Parchemins</span>
      <span class="card-subtitle muted">La bibliothèque du camp</span>
    </button>

    {#if campStore.data}
      <button type="button" class="card" data-testid="camp-oracle" onclick={() => go('oracle')}>
        <span class="card-glyph" aria-hidden="true">🔮{#if campStore.data.oracle.status === 'sealed'}<span class="badge-dot" aria-hidden="true"></span>{/if}</span>
        <span class="card-title">Delphes — l'Oracle</span>
        <span class="card-subtitle muted">
          {campStore.data.oracle.status === 'sealed'
            ? "Trois rouleaux scellés t'attendent cette semaine."
            : "L'Oracle a parlé. Quête en cours."}
        </span>
      </button>

      <button type="button" class="card" data-testid="camp-quests" onclick={() => go('quests')}>
        <span class="card-glyph" aria-hidden="true">🗺️</span>
        <span class="card-title">Tableau des quêtes</span>
        <span class="card-subtitle muted">{activeQuestsCount} quête(s) en cours</span>
      </button>

      <button type="button" class="card" data-testid="camp-bestiary" onclick={() => go('bestiaire')}>
        <span class="card-glyph" aria-hidden="true">🐉</span>
        <span class="card-title">Bestiaire et monstres</span>
        <span class="card-subtitle muted"
          >{neutralisedCount} sur {availableLieutenantsCount} ruse(s) neutralisée(s) · les vrais mythes</span
        >
      </button>

      <button type="button" class="card" data-testid="camp-dossier" onclick={() => go('dossier')}>
        <span class="card-glyph" aria-hidden="true">📖</span>
        <span class="card-title">Le dossier d'Éris</span>
        <span class="card-subtitle muted">« Ses points faibles »… selon elle</span>
      </button>

      <button type="button" class="card" data-testid="camp-cabin" onclick={() => go('cabin')}>
        <span class="card-glyph" aria-hidden="true">🏺</span>
        <span class="card-title">Ta cabane</span>
        <span class="card-subtitle muted">{campStore.data.rewards_count} trésor(s)</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .camp {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .scene {
    height: 34vh;
    min-height: 220px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 8px;
    padding: 20px;
  }
  @media (orientation: portrait) {
    .scene {
      height: 26vh;
    }
  }
  .scene > * {
    position: relative;
    z-index: 1;
  }
  .scene h1 {
    margin: 0;
  }
  /* P1-6: translucent parchment backing so the rank/XP/weekly-goal text stays >= 4.5:1 against
     the camp painting no matter what's behind it - `--marble` at 0.85 opacity, same tone as the
     rest of the UI's cards/parchments, not a new colour. */
  .hud-panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    border-radius: var(--radius);
    background: rgba(244, 239, 230, 0.85);
  }
  .xp-line {
    margin: 0;
    font-weight: 600;
  }
  .weekly {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    flex-wrap: wrap;
  }
  .leaves {
    font-size: 20px;
    letter-spacing: 2px;
  }
  .leaf {
    filter: grayscale(1) opacity(0.5);
  }
  .leaf.filled {
    filter: none;
  }
  .weekly-caption {
    font-weight: 600;
  }
  .status-line {
    margin: 0;
  }
  .dragon-card {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .dragon-art {
    display: flex;
    flex-shrink: 0;
  }
  .dragon-bubble {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
  }
  .dragon-name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 18px;
  }
  .banner-prophecy {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px;
  }
  .banner-prophecy p {
    margin: 0;
    color: var(--gold);
    font-weight: 600;
  }
  .banner-boss {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    text-align: left;
  }
  .boss-art {
    height: 120px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .boss-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .boss-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 18px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }
  .grid .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .card-glyph {
    font-size: 28px;
    position: relative;
    width: fit-content;
  }
  .badge-dot {
    position: absolute;
    top: -2px;
    right: -8px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--gold);
  }
  .card-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 18px;
  }
  .card-subtitle {
    font-size: 14px;
  }
</style>
