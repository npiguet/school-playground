<script lang="ts">
  // Delphes: the weekly Consultation de l'Oracle (spec §3.6, plan Decision 9). Three scrolls, one
  // choice per ISO week, the reward known in advance and identical whichever scroll is opened (no
  // gamble - ethics). Also shows the Oracle's prophecies (dictées préparées, Decision 10).
  import TopBar from '../components/TopBar.svelte';
  import Scroll from '../components/Scroll.svelte';
  import QuestCard from '../components/QuestCard.svelte';
  import Particles from '../components/juice/Particles.svelte';
  import { ART } from '../lib/world/art';
  import { worldApi } from '../lib/world/api';
  import { campStore, refreshCamp, loadCatalog } from '../lib/world/campStore.svelte';
  import { LIEUTENANT_ORDER, type LieutenantKey, type OracleOut, type ScrollKey } from '../lib/world/types';
  import { entry as bestiaryEntry } from '../lib/world/bestiary';
  import { confirmChoiceLabel } from '../lib/world/eris';
  import { ApiError } from '../lib/api';
  import { formatSwissDate } from '../lib/dates';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { href } from '../lib/routes';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  const profileId = $derived(String(profile.id));

  const FALLBACK_GLYPHS: Record<LieutenantKey, string> = {
    hydre: '🐍',
    echo: '🔊',
    chimere: '🦁',
    protee: '🌊',
    sirenes: '🎶',
    lethe: '🌫️',
  };

  let oracle = $state<OracleOut | null>(null);
  let loading = $state(true);
  let loadError = $state('');

  // The 'ecole' scroll needs an extra step (picking a monster) before it can be consulted -
  // this opens the picker locally, without touching the server or the other two scrolls.
  let ecolePickerOpen = $state(false);
  let selectedMonster = $state<string | null>(null);

  let consultingScroll = $state<ScrollKey | null>(null);
  let consultError = $state('');
  let burstTrigger = $state(0);

  async function load() {
    loading = true;
    loadError = '';
    try {
      const [o] = await Promise.all([worldApi.oracle(profile.id), loadCatalog(), refreshCamp(profile.id)]);
      oracle = o;
    } catch (e) {
      loadError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }

  load();

  const globallySealed = $derived(oracle?.status === 'sealed');

  function revealedFor(key: ScrollKey): { name: string; art: string } | null {
    if (!oracle || oracle.status !== 'chosen') return null;
    const s = oracle.scrolls.find((sc) => sc.key === key);
    if (!s?.lieutenant) return null;
    const e = bestiaryEntry(s.lieutenant);
    return e ? { name: e.name, art: e.art } : null;
  }

  const chosenKey = $derived.by(() => {
    if (!oracle || oracle.status !== 'chosen') return null;
    return oracle.scrolls.find((s) => s.lieutenant)?.key ?? null;
  });

  function isAvailable(key: LieutenantKey): boolean {
    return campStore.data?.lieutenants.find((l) => l.key === key)?.available ?? true;
  }

  function glyphFor(key: LieutenantKey): string {
    return campStore.catalog?.lieutenants.find((l) => l.key === key)?.glyph ?? FALLBACK_GLYPHS[key];
  }

  function nameFor(key: string): string {
    return campStore.catalog?.lieutenants.find((l) => l.key === key)?.name ?? bestiaryEntry(key)?.name ?? key;
  }

  const names = $derived.by(() => {
    const out: Record<string, string> = { eris: 'Éris' };
    for (const l of campStore.catalog?.lieutenants ?? []) out[l.key] = l.name;
    return out;
  });

  function openScroll(key: ScrollKey) {
    unlockAudio();
    playSfx('tap');
    if (key === 'ecole') {
      ecolePickerOpen = true;
      return;
    }
    void consult(key);
  }

  function confirmEcole() {
    if (!selectedMonster) return;
    void consult('ecole', selectedMonster);
  }

  // M4: cancelling closes the picker without ever having touched `sealed` - no seal-break
  // sound, no sparkles, nothing to undo.
  function cancelEcole() {
    ecolePickerOpen = false;
    selectedMonster = null;
  }

  async function consult(scroll: ScrollKey, lieutenant?: string) {
    consultingScroll = scroll;
    consultError = '';
    try {
      const { oracle: updated } = await worldApi.consult(profile.id, { scroll, lieutenant });
      oracle = updated;
      ecolePickerOpen = false;
      playSfx('chime');
      burstTrigger += 1;
      await refreshCamp(profile.id);
    } catch (e) {
      consultError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
      // A 409 usually means another tab already consulted this week - resync so the screen
      // reflects reality rather than repeating a doomed request.
      await load();
    } finally {
      consultingScroll = null;
    }
  }

  function oracleRewardLine(): string {
    const bonus = campStore.catalog?.quest_bonus.oracle ?? 150;
    const rewardId = oracle?.reward_id ?? null;
    const name = rewardId ? campStore.catalog?.rewards[rewardId]?.name : undefined;
    return name ? `${bonus} XP · ${name}` : `${bonus} XP`;
  }
</script>

<TopBar {profile} title="Delphes — l'Oracle" />

<div class="screen oracle">
  <div class="scene" style="background-image:url({ART.scenes.delphes})">
    <h1>L'Oracle de Delphes</h1>
  </div>

  {#if loading}
    <p class="muted">Les Muses consultent la Pythie…</p>
  {:else if loadError}
    <p class="orange">Impossible de rejoindre l'Oracle : {loadError}</p>
  {:else if oracle}
    {#if oracle.prophecies.length > 0}
      <section>
        <h2>Prophéties</h2>
        <p class="muted">
          L'Oracle a vu une dictée arriver à l'école. Révise-la avant le jour dit : l'XP est multipliée par 1,5.
        </p>
        <ul class="prophecy-list">
          {#each oracle.prophecies as p (p.text_id)}
            <li class="parchment prophecy-row" data-testid="oracle-prophecy-{p.text_id}">
              <p>
                « {p.title} » — dictée le {formatSwissDate(p.due_date)} ·
                {p.days_left === 0 ? "c'est aujourd'hui" : `dans ${p.days_left} jour(s)`}
              </p>
              <a class="btn btn-primary" href={href('play', { profileId, textId: String(p.text_id) })}>Réviser</a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section>
      <h2>Les trois rouleaux</h2>
      <p class="reward-line" data-testid="oracle-reward">
        Cette semaine, ouvrir un rouleau rapporte : {oracleRewardLine()}
      </p>

      {#if consultError}
        <p class="orange" role="alert">{consultError}</p>
      {/if}

      {#snippet ecolePicker()}
        <div class="picker">
          <p>Choisis le monstre :</p>
          <div class="picker-grid">
            {#each LIEUTENANT_ORDER as key (key)}
              <button
                type="button"
                class="chip"
                class:chip-active={selectedMonster === key}
                data-testid="oracle-monster-{key}"
                disabled={!isAvailable(key)}
                onclick={() => (selectedMonster = key)}
              >
                <span aria-hidden="true">{glyphFor(key)}</span>
                {nameFor(key)}{!isAvailable(key) ? ' · dort encore' : ''}
              </button>
            {/each}
          </div>
          <div class="picker-actions">
            <button type="button" class="btn" data-testid="oracle-cancel" onclick={cancelEcole}>Annuler</button>
            <button
              type="button"
              class="btn btn-primary"
              data-testid="oracle-confirm"
              disabled={!selectedMonster || consultingScroll === 'ecole'}
              onclick={confirmEcole}
            >
              {selectedMonster ? confirmChoiceLabel(selectedMonster as LieutenantKey) : "C'est celui-là"}
            </button>
          </div>
        </div>
      {/snippet}

      <div class="scrolls-wrap">
        {#each oracle.scrolls as s (s.key)}
          <Scroll
            testid="scroll-{s.key}"
            title={s.title}
            hint={s.hint}
            sealed={globallySealed}
            revealed={revealedFor(s.key)}
            reward={oracleRewardLine()}
            busy={consultingScroll === s.key}
            onOpen={() => openScroll(s.key)}
            sealedStep={s.key === 'ecole' && ecolePickerOpen ? ecolePicker : undefined}
            quiet={oracle.status === 'chosen' && chosenKey !== s.key}
          >
            {#if oracle.status === 'chosen' && chosenKey !== s.key}
              <p class="muted closed-note">Refermé jusqu'à lundi.</p>
            {/if}
          </Scroll>
        {/each}
        {#if burstTrigger > 0}
          <Particles trigger={burstTrigger} kind="burst" />
        {/if}
      </div>
    </section>

    {#if oracle.status === 'chosen' && oracle.quest && campStore.catalog}
      <section data-testid="oracle-quest">
        <h2>La quête de la semaine</h2>
        <QuestCard quest={oracle.quest} {names} catalog={campStore.catalog} profileId={profile.id} />
        <p class="muted">L'Oracle parlera de nouveau lundi.</p>
      </section>
    {/if}
  {/if}
</div>

<style>
  .oracle {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .scene {
    height: 22vh;
    min-height: 160px;
    display: flex;
    align-items: flex-end;
    padding: 16px;
  }
  .scene h1 {
    position: relative;
    z-index: 1;
    margin: 0;
  }
  .prophecy-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .prophecy-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
  }
  .prophecy-row p {
    margin: 0;
  }
  .reward-line {
    font-weight: 600;
    color: var(--gold);
  }
  .scrolls-wrap {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  @media (orientation: portrait) {
    .scrolls-wrap {
      grid-template-columns: 1fr;
    }
  }
  .picker {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .picker-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  /* M10: these chips are the primary tap targets for choosing a monster, not decorative
     labels - bump them to the project's ≥48px convention (app.css's .btn/.card/inputs are all
     48px; the generic .chip is only 40px). */
  .picker-grid :global(.chip) {
    min-height: 48px;
  }
  .picker-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .closed-note {
    margin: 0;
  }
</style>
