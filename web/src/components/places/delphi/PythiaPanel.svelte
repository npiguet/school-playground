<script lang="ts">
  // Delphes: the weekly Consultation de l'Oracle (spec §3.6, plan Decision 9). Three scrolls, one
  // choice per ISO week, the reward known in advance and identical whichever scroll is opened (no
  // gamble - ethics). Also shows the Oracle's prophecies (dictées préparées, Decision 10).
  // UI3a Task 12: opened as the Pythia's overlay over the Delphi scene (Delphi.svelte); the scene
  // itself paints the temple, so this panel is just the scrolls and the quest they choose.
  // Immersion wave (playability #8, #9, #19): three rolled scrolls on their stands; the one opened
  // (or the school scroll while its monster is chosen) unrolls across the whole panel; the reward
  // is said once; prophecies are spoken by their day. The seal-break sounds and sparkles live here.
  import { tick } from 'svelte';
  import OracleScroll from './OracleScroll.svelte';
  import QuestCard from '../../QuestCard.svelte';
  import Particles from '../../juice/Particles.svelte';
  import Medallion from '../../juice/Medallion.svelte';
  import LieutenantBadge from '../../LieutenantBadge.svelte';
  import { worldApi } from '../../../lib/world/api';
  import { campFor, campStore, refreshCamp } from '../../../lib/world/campStore.svelte';
  import { LIEUTENANT_ORDER, type LieutenantKey, type OracleOut, type ScrollKey } from '../../../lib/world/types';
  import { entry as bestiaryEntry } from '../../../lib/world/bestiary';
  import { confirmChoiceLabel, sleepingCaption } from '../../../lib/world/eris';
  import { ApiError } from '../../../lib/api';
  import { longDate } from '../../../lib/text/french';
  import { reducedMotion } from '../../../lib/juice/motion';
  import { go } from '../../../lib/scene/panelNav';
  import { playSfx, unlockAudio } from '../../../lib/juice/sfx';
  import { href } from '../../../lib/routes';
  import { prophecyBonus, prophecyWhen } from '../../../lib/world/prophecy';
  import { scrollTitle } from '../../../lib/world/scenes/delphi';
  import type { Profile } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  const profileId = $derived(String(profile.id));

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
      // Delphi's PlaceScene loads /camp and the catalog (final review M15).
      oracle = await worldApi.oracle(profile.id);
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
    // This hero's snapshot only (final review I2).
    return campFor(profile.id)?.lieutenants.find((l) => l.key === key)?.available ?? true;
  }

  function nameFor(key: string): string {
    return campStore.catalog?.lieutenants.find((l) => l.key === key)?.name ?? bestiaryEntry(key)?.name ?? key;
  }

  const names = $derived.by(() => {
    const out: Record<string, string> = { eris: 'Éris' };
    for (const l of campStore.catalog?.lieutenants ?? []) out[l.key] = l.name;
    return out;
  });

  // Ruling W-f (re-review N1): while the week is not chosen, the three scrolls lead - choosing one is
  // what she came to the Pythia for, and the altar card already shows the nearest prophecy on the
  // scene. Once the week is chosen, the prophecies lead (the scrolls are done until Monday).
  const prophecyFirst = $derived(oracle?.status === 'chosen');

  const reduced = reducedMotion();
  let pickerEl = $state<HTMLElement | null>(null);
  let scrollsEl = $state<HTMLElement | null>(null);

  // The scroll that lies unrolled across the panel: the school scroll while its monster is being
  // chosen, the chosen one once the week's choice is made. The row of three rolls is not drawn then.
  const unrolled = $derived<ScrollKey | null>(ecolePickerOpen ? 'ecole' : oracle?.status === 'chosen' ? chosenKey : null);

  function openScroll(key: ScrollKey) {
    unlockAudio();
    playSfx('tap');
    if (key === 'ecole') {
      ecolePickerOpen = true;
      // Playability #9: the choice she has to make is in view, whatever the panel's scroll.
      void tick().then(() => pickerEl?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }));
      return;
    }
    void consult(key);
  }

  function review(textId: number) {
    go(href('play', { profileId, textId: String(textId) }));
  }

  function confirmEcole() {
    if (!selectedMonster) return;
    void consult('ecole', selectedMonster);
  }

  // M4: cancelling closes the picker without consulting - no seal-break sound, no sparkles,
  // nothing to undo; the three rolls come back.
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
      // The wax breaks, then the scroll unrolls (what the old Scroll.svelte played on its own).
      playSfx('seal');
      setTimeout(() => playSfx('unroll'), 130);
      playSfx('chime');
      burstTrigger += 1;
      // The opened scroll, its monster first: in view even if she scrolled down to its seal.
      void tick().then(() => scrollsEl?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' }));
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

{#snippet propheciesSection(prophecies: OracleOut['prophecies'])}
  {#if prophecies.length > 0}
    <!-- Re-review N1/N6: no heading and no rule paragraph; each strip carries its own bonus tag. -->
    <section data-testid="oracle-prophecies" aria-labelledby="oracle-prophecies-title">
      <h3 id="oracle-prophecies-title" class="sr-only">Prophéties</h3>
      <ul class="prophecy-list">
        {#each prophecies as p (p.text_id)}
          {@const bonus = prophecyBonus(p)}
          <li class="kit-sheet prophecy-row" data-testid="oracle-prophecy-{p.text_id}">
            <p>
              <span class="prophecy-title">« {p.title} »</span>
              <span class="prophecy-when">{longDate(p.due_date)} · {prophecyWhen(p.days_left)}</span>
              {#if bonus}<span class="prophecy-bonus" data-testid="oracle-prophecy-bonus">{bonus}</span>{/if}
            </p>
            <button type="button" class="kit-bronze" onclick={() => review(p.text_id)}>Te préparer</button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{/snippet}

<div class="panel-pythia oracle">
  {#if loading}
    <p class="muted">Les Muses consultent la Pythie…</p>
  {:else if loadError}
    <p class="kit-note" data-tone="eris">Impossible de rejoindre l'Oracle : {loadError}</p>
  {:else if oracle}
    {#if prophecyFirst}{@render propheciesSection(oracle.prophecies)}{/if}
    <!-- Re-review N1: no visible heading over the scrolls (the reward line leads them); the h3 stays
         for heading navigation, above the scrolls' own h4s. -->
    <section data-testid="oracle-scrolls" aria-labelledby="oracle-scrolls-title">
      <h3 id="oracle-scrolls-title" class="sr-only">Les trois rouleaux</h3>
      <!-- Playability #8: the reward once, with its medallion, in dark bronze. -->
      <div class="reward-line" data-testid="oracle-reward">
        {#if oracle.reward_id}<Medallion rewardId={oracle.reward_id} size={36} />{/if}
        <span>Cette semaine, le rouleau que tu ouvres rapporte : {oracleRewardLine()}</span>
      </div>
      {#if consultError}<p class="kit-note" data-tone="eris" role="alert">{consultError}</p>{/if}

      <div class="scrolls-wrap" bind:this={scrollsEl}>
        {#if unrolled}
          {@const s = oracle.scrolls.find((sc) => sc.key === unrolled)!}
          <OracleScroll testid="scroll-{s.key}" title={scrollTitle(s.key, s.title)} hint={s.hint} mode="unrolled">
            {#if ecolePickerOpen}
              <div class="picker" bind:this={pickerEl}>
                <p class="picker-ask">Quel monstre ta classe prépare-t-elle ?</p>
                <div class="picker-grid">
                  {#each LIEUTENANT_ORDER as key (key)}
                    <button
                      type="button"
                      class="monster"
                      class:is-picked={selectedMonster === key}
                      aria-pressed={selectedMonster === key}
                      data-testid="oracle-monster-{key}"
                      disabled={!isAvailable(key)}
                      onclick={() => (selectedMonster = key)}
                    >
                      <LieutenantBadge lieutenantKey={key} size={72} />
                      <span class="monster-name">{nameFor(key)}</span>
                      {#if !isAvailable(key)}<span class="monster-note">{sleepingCaption(key).toLowerCase()}</span>{/if}
                    </button>
                  {/each}
                </div>
                <div class="picker-actions">
                  <button type="button" class="kit-bronze is-quiet" data-testid="oracle-cancel" onclick={cancelEcole}>Annuler</button>
                  <button
                    type="button"
                    class="kit-bronze"
                    data-testid="oracle-confirm"
                    disabled={!selectedMonster || consultingScroll === 'ecole'}
                    onclick={confirmEcole}
                  >
                    {selectedMonster ? confirmChoiceLabel(selectedMonster as LieutenantKey) : "C'est celui-là"}
                  </button>
                </div>
              </div>
            {:else if revealedFor(s.key)}
              {@const r = revealedFor(s.key)!}
              <div class="revealed">
                <img src={r.art} alt={r.name} class="revealed-art pop" />
                <p class="revealed-name pop">{r.name}</p>
              </div>
            {/if}
          </OracleScroll>
          {#if oracle.status === 'chosen'}
            <div class="closed-rolls">
              {#each oracle.scrolls.filter((sc) => sc.key !== unrolled) as c (c.key)}
                <OracleScroll testid="scroll-{c.key}" title={scrollTitle(c.key, c.title)} hint={c.hint} mode="closed">
                  <p class="muted closed-note">Refermé jusqu'à lundi.</p>
                </OracleScroll>
              {/each}
            </div>
          {/if}
        {:else}
          <!-- A sealed week: three rolls to open. A chosen week with no revealed scroll (the only
               other status): all three closed until Monday, as the old panel showed it. -->
          <div class="rolls">
            {#each oracle.scrolls as s (s.key)}
              <OracleScroll
                testid="scroll-{s.key}"
                title={scrollTitle(s.key, s.title)}
                hint={s.hint}
                mode={globallySealed ? 'rolled' : 'closed'}
                busy={consultingScroll === s.key}
                onOpen={() => openScroll(s.key)}
              >
                <p class="muted closed-note">Refermé jusqu'à lundi.</p>
              </OracleScroll>
            {/each}
          </div>
        {/if}
        {#if burstTrigger > 0}<Particles trigger={burstTrigger} kind="burst" />{/if}
      </div>
    </section>

    {#if oracle.status === 'chosen' && oracle.quest && campStore.catalog}
      <section data-testid="oracle-quest">
        <h3 class="kit-section">La quête de la semaine</h3>
        <QuestCard quest={oracle.quest} {names} catalog={campStore.catalog} profileId={profile.id} />
        <p class="muted">L'Oracle parlera de nouveau lundi.</p>
      </section>
    {/if}

    {#if !prophecyFirst}{@render propheciesSection(oracle.prophecies)}{/if}
  {/if}
</div>

<style>
  /* The bottom room lets the last line scroll fully clear of the body's faded edge and the rod. */
  .oracle {
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding-bottom: 16px;
  }
  .reward-line {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 12px;
    font-weight: 600;
    font-size: 17px;
    color: var(--reward-ink);
  }
  /* Review fix round 1: a scrollIntoView (the picker; the scroll just consulted) stops short of
     the body's faded top edge under the voice plate, with room for the sheet's top rod and title. */
  .scrolls-wrap {
    position: relative;
    scroll-margin-top: 24px;
  }
  .rolls {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
  }
  .picker {
    scroll-margin-top: 72px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  .picker-ask {
    margin: 0;
    font-size: 18px;
    font-style: italic;
  }
  /* Playability #9: a 3x2 grid of monster medallions, names under them. Re-review N12: straight on
     the parchment (no card boxes); the medallion and its name are the whole (>= 48 px) target, and
     the chosen one is ringed in gold. */
  .picker-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(120px, 1fr));
    gap: 8px 12px;
    width: 100%;
  }
  .monster {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 6px;
    border: 0;
    border-radius: 12px;
    background: none;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .monster.is-picked :global(.lt-badge) {
    border-color: var(--gold-light);
    box-shadow:
      0 0 0 3px var(--gold-light),
      0 0 16px rgba(255, 220, 140, 0.85);
  }
  .monster.is-picked .monster-name {
    color: var(--bronze-dark);
  }
  .monster:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .monster:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .monster-name {
    font-weight: 700;
    font-size: 17px;
  }
  .monster-note {
    font-size: 14px;
    font-style: italic;
  }
  .picker-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }
  .closed-rolls {
    display: flex;
    justify-content: center;
    gap: 40px;
    margin-top: 10px;
  }
  .closed-note {
    margin: 0;
  }
  .revealed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .revealed-art {
    max-height: 200px;
    object-fit: contain;
  }
  .revealed-name {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
  }
  .pop {
    animation: pop 0.4s both;
  }
  .prophecy-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .prophecy-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .prophecy-row p {
    margin: 0;
  }
  .prophecy-title {
    font-weight: 700;
  }
  /* Re-review N6: the prophecy's bonus, a reward-ink tag on its own line of the strip. */
  .prophecy-bonus {
    display: block;
    margin-top: 2px;
    font-weight: 600;
    font-size: 15px;
    color: var(--reward-ink);
  }
  @media (orientation: portrait) {
    .rolls {
      grid-template-columns: 1fr;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pop {
      animation: none;
    }
  }
</style>
