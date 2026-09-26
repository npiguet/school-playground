<script lang="ts">
  // A lieutenant's portrait sheet (UI3 Ruling B4), handed over by the war tent's scroll overlay
  // (WarTent.svelte): the mastery gauges (Decision 3's 3-day / 10-trap / 80% window) and the actions
  // that launch a quest or a focused Grimoire corrompu (Decision 21). Éris's line for the current
  // band is the overlay's voice plate (Ruling B10), not part of this panel. Degrades gracefully when
  // the world API isn't reachable: the technique/state sections just stay empty rather than crash.
  import Medallion from '../../juice/Medallion.svelte';
  import { ART, RELIC_OF } from '../../../lib/world/art';
  import { worldApi } from '../../../lib/world/api';
  import { campStore, refreshCamp, loadCatalog } from '../../../lib/world/campStore.svelte';
  import { LIEUTENANT_ORDER, type LieutenantKey, type QuestOut } from '../../../lib/world/types';
  import { agree, stirringCaption } from '../../../lib/world/eris';
  import { entry as bestiaryEntry } from '../../../lib/world/bestiary';
  import { lengthOf } from '../../../lib/library/shelf';
  import { longDate } from '../../../lib/text/french';
  import { ApiError } from '../../../lib/api';
  import type { Profile } from '../../../lib/types';
  import { href } from '../../../lib/routes';
  import { go } from '../../../lib/scene/panelNav';

  let { profile, lieutenantKey }: { profile: Profile; lieutenantKey: string } = $props();

  const profileId = $derived(String(profile.id));
  const isKnownKey = $derived(LIEUTENANT_ORDER.includes(lieutenantKey as LieutenantKey));

  $effect(() => {
    void refreshCamp(profile.id);
    void loadCatalog();
  });

  const lieutenantState = $derived(campStore.data?.lieutenants.find((l) => l.key === lieutenantKey) ?? null);
  const catalogEntry = $derived(campStore.catalog?.lieutenants.find((l) => l.key === lieutenantKey) ?? null);
  const name = $derived(
    lieutenantState?.name ?? catalogEntry?.name ?? bestiaryEntry(lieutenantKey)?.name ?? lieutenantKey,
  );
  const art = $derived(isKnownKey ? ART.lieutenants[lieutenantKey as LieutenantKey] : ART.erisSmug);
  const relicId = $derived(isKnownKey ? RELIC_OF[lieutenantKey as LieutenantKey] : '');
  const relicName = $derived(campStore.catalog?.rewards[relicId]?.name ?? `Relique de ${name}`);
  const questXp = $derived(campStore.catalog?.quest_bonus.board ?? 60);

  const days = $derived(lieutenantState?.window.days ?? 0);
  const traps = $derived(lieutenantState?.window.traps ?? 0);
  const rate = $derived(lieutenantState?.window.rate ?? null);

  let createdQuest = $state<QuestOut | null>(null);
  let creating = $state(false);
  let questError = $state('');
  let toast = $state('');

  const activeQuestId = $derived(lieutenantState?.active_quest_id ?? createdQuest?.id ?? null);
  const activeQuest = $derived(
    (activeQuestId && campStore.data?.quests.find((q) => q.id === activeQuestId)) || createdQuest,
  );
  const recommendedTexts = $derived(activeQuest?.texts ?? null);

  function showToast(message: string) {
    toast = message;
    setTimeout(() => {
      if (toast === message) toast = '';
    }, 2500);
  }

  async function launchQuest() {
    questError = '';
    creating = true;
    try {
      createdQuest = await worldApi.createQuest(profile.id, lieutenantKey);
      showToast('Quête affichée au mur.');
      await refreshCamp(profile.id);
    } catch (e) {
      questError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      creating = false;
    }
  }

  function pct(rate: number | null): string {
    return rate === null ? '—' : `${Math.round(rate * 100)} %`;
  }

  function playHref(t: { id: number }): string {
    const query: Record<string, string> = { encounter: lieutenantKey };
    if (activeQuestId != null) query.quest = String(activeQuestId);
    return href('play', { profileId, textId: String(t.id) }, query);
  }

  function grimoireHref(textId: number): string {
    return href('grimoire', { profileId, textId: String(textId) }, { focus: lieutenantKey });
  }
</script>

<div class="panel-portrait">
  {#if !isKnownKey}
    <p class="muted">Ce lieutenant n'existe pas… encore.</p>
  {:else}
    <figure class="portrait-plate" style="background-image:url({ART.scenes.battle})">
      <img src={art} alt={name} class="portrait" />
    </figure>

    {#if catalogEntry}
      <p class="technique">{catalogEntry.technique}</p>
    {/if}

    {#if lieutenantState}
      {#if lieutenantState.neutralised}
        <div class="kit-sheet neutralised-banner" data-testid="lieutenant-neutralised">
          <Medallion rewardId={relicId} size={64} label={relicName} />
          <p>{agree('Neutralisé', lieutenantKey as LieutenantKey)} le {longDate((lieutenantState.neutralised_at ?? '').slice(0, 10))}</p>
        </div>
      {/if}

      {#if lieutenantState.stirring}
        <p class="kit-note" data-tone="eris">{name} {stirringCaption(lieutenantKey as LieutenantKey).toLowerCase()} à nouveau. Une quête de revanche ?</p>
      {/if}

      <div class="gauges">
        <div class="kit-gauge" data-testid="lieutenant-gauge-days" data-state={days >= 3 ? 'ok' : 'short'} style:--fill="{Math.min(100, (days / 3) * 100)}%">
          <span class="kit-gauge-label">Jours de défense : {days}/3</span>
          <span class="kit-gauge-track"><span class="kit-gauge-fill"></span></span>
        </div>
        <div class="kit-gauge" data-testid="lieutenant-gauge-traps" data-state={traps >= 10 ? 'ok' : 'short'} style:--fill="{Math.min(100, (traps / 10) * 100)}%">
          <span class="kit-gauge-label">Pièges rencontrés : {traps}/10</span>
          <span class="kit-gauge-track"><span class="kit-gauge-fill"></span></span>
        </div>
        <div class="kit-gauge" data-testid="lieutenant-rate" data-state={(rate ?? 0) >= 0.8 ? 'ok' : 'short'} style:--fill="{Math.min(100, Math.round((rate ?? 0) * 100))}%">
          <span class="kit-gauge-label">Pièges déjoués : {pct(rate)}, il en faut 80 %</span>
          <span class="kit-gauge-track"><span class="kit-gauge-fill"></span><span class="target-mark" style="left:80%" aria-hidden="true"></span></span>
        </div>
      </div>

      {#if questError}
        <p class="kit-note" data-tone="eris" role="alert">{questError}</p>
      {/if}
      {#if toast}
        <p class="kit-note" role="status">{toast}</p>
      {/if}

      <div class="actions">
        <button
          type="button"
          class="kit-bronze"
          data-testid="lieutenant-quest"
          disabled={!!lieutenantState.active_quest_id || creating}
          onclick={launchQuest}
        >
          {lieutenantState.active_quest_id ? 'Quête en cours' : 'Lancer une quête'}
        </button>
        <p class="reward-line">Récompense : {questXp} XP et une page du bestiaire</p>

        {#if recommendedTexts && recommendedTexts.length > 0}
          <button
            type="button"
            class="kit-bronze is-quiet"
            data-testid="lieutenant-grimoire"
            onclick={() => go(grimoireHref(recommendedTexts![0].id))}
          >
            Ouvrir son grimoire corrompu
          </button>
        {/if}
      </div>

      <section class="recommended">
        <h3 class="kit-section">Textes conseillés</h3>
        {#if !recommendedTexts}
          <p class="muted">Lance une quête pour recevoir trois textes conseillés.</p>
        {:else}
          <ul class="text-list">
            {#each recommendedTexts as t (t.id)}
              <li>
                <a class="kit-tag" data-testid="lieutenant-text-{t.id}" href={playHref(t)}>
                  <span class="kit-tag-title">{t.title}</span>
                  <span class="kit-tag-meta">parchemin {lengthOf(t.word_count)}</span>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {:else if campStore.error}
      <p class="muted">Impossible de charger ce lieutenant : {campStore.error}</p>
    {:else}
      <p class="muted">Les Muses cherchent ce lieutenant…</p>
    {/if}
  {/if}
</div>

<style>
  .panel-portrait {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .portrait-plate {
    position: relative;
    overflow: hidden;
    margin: 0;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--kit-radius);
    background-size: cover;
    background-position: center bottom;
    box-shadow: inset 0 0 0 2px rgba(92, 64, 24, 0.35);
  }
  .portrait {
    position: relative;
    z-index: 1;
    max-height: 180px;
    object-fit: contain;
  }
  .technique {
    margin: 0;
    font-style: italic;
  }
  .neutralised-banner {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
  }
  .neutralised-banner p {
    margin: 0;
    font-weight: 600;
  }
  .gauges {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .gauges .kit-gauge-track {
    overflow: visible;
  }
  .target-mark {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    background: var(--gold);
  }
  .actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .reward-line {
    margin: 0;
    color: var(--reward-ink);
    font-weight: 600;
  }
  .text-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .text-list a {
    text-decoration: none;
  }
</style>
