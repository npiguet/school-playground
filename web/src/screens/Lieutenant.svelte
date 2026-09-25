<script lang="ts">
  // A lieutenant's own page: Éris's line for the current band, the mastery gauges (Decision 3's
  // 3-day / 10-trap / 80% window), and the actions that launch a quest or a focused Grimoire
  // corrompu (Decision 21). Degrades gracefully when the world API isn't reachable yet (SP3
  // server Tasks 2-3): the technique/state sections just stay empty rather than crash.
  import TopBar from '../components/TopBar.svelte';
  import Medallion from '../components/juice/Medallion.svelte';
  import { ART, RELIC_OF } from '../lib/world/art';
  import { worldApi } from '../lib/world/api';
  import { campStore, refreshCamp, loadCatalog } from '../lib/world/campStore.svelte';
  import { LIEUTENANT_ORDER, type LieutenantKey, type QuestOut } from '../lib/world/types';
  import { agree, bandFor, dossierLine } from '../lib/world/eris';
  import { entry as bestiaryEntry } from '../lib/world/bestiary';
  import { ApiError } from '../lib/api';
  import type { Profile } from '../lib/types';
  import { href } from '../lib/routes';
  import { go } from '../lib/scene/panelNav';

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
  const band = $derived(lieutenantState ? bandFor(lieutenantState) : 'none');
  const questXp = $derived(campStore.catalog?.quest_bonus.board ?? 60);

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
      showToast('Quête affichée au tableau.');
      await refreshCamp(profile.id);
    } catch (e) {
      questError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      creating = false;
    }
  }

  function pct(rate: number | null): string {
    return rate === null ? '—' : `${Math.round(rate * 100)} %`;
  }

  function neutralisedDate(): string {
    const iso = lieutenantState?.neutralised_at;
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}.${m}.${y}`;
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

<TopBar {profile} title={name} />

<div class="screen">
  {#if !isKnownKey}
    <p class="muted">Ce lieutenant n'existe pas… encore.</p>
  {:else}
    <div class="scene header" style="background-image:url({ART.scenes.battle})">
      <img src={art} alt={name} class="portrait wobble-hover" />
    </div>

    {#if catalogEntry}
      <p class="technique">{catalogEntry.technique}</p>
    {/if}

    {#if lieutenantState}
      <p class="eris-line">{dossierLine(lieutenantKey as LieutenantKey, band)}</p>

      {#if lieutenantState.neutralised}
        <div class="parchment neutralised-banner" data-testid="lieutenant-neutralised">
          <Medallion rewardId={relicId} size={64} label={relicName} />
          <p>{agree('Neutralisé', lieutenantKey as LieutenantKey)} le {neutralisedDate()}</p>
        </div>
      {/if}

      {#if lieutenantState.stirring}
        <p class="orange">« {name} s'agite à nouveau. Une quête de revanche ? »</p>
      {/if}

      <div class="gauges">
        <div data-testid="lieutenant-gauge-days" class="gauge-block">
          <p class="gauge-label">{lieutenantState.window.days}/3 jours différents</p>
          <div class="bar"><div class="bar-fill" style="width:{Math.min(100, (lieutenantState.window.days / 3) * 100)}%"></div></div>
        </div>
        <div data-testid="lieutenant-gauge-traps" class="gauge-block">
          <p class="gauge-label">{lieutenantState.window.traps}/10 pièges rencontrés</p>
          <div class="bar"><div class="bar-fill" style="width:{Math.min(100, (lieutenantState.window.traps / 10) * 100)}%"></div></div>
        </div>
        <div data-testid="lieutenant-rate" class="gauge-block">
          <p class="gauge-label">Taux dans la fenêtre : {pct(lieutenantState.window.rate)}</p>
          <div class="bar rate-bar">
            <div class="bar-fill" style="width:{Math.min(100, Math.round((lieutenantState.window.rate ?? 0) * 100))}%"></div>
            <div class="target-marker" style="left:80%" title="Objectif : 80 %"></div>
          </div>
        </div>
      </div>

      {#if questError}
        <p class="orange" role="alert">{questError}</p>
      {/if}
      {#if toast}
        <p class="toast" role="status">{toast}</p>
      {/if}

      <div class="actions">
        <button
          type="button"
          class="btn btn-primary"
          data-testid="lieutenant-quest"
          disabled={!!lieutenantState.active_quest_id || creating}
          onclick={launchQuest}
        >
          {lieutenantState.active_quest_id ? 'Quête en cours' : 'Lancer une quête'}
        </button>
        <p class="muted reward-line">Récompense : {questXp} XP · page du bestiaire</p>

        {#if recommendedTexts && recommendedTexts.length > 0}
          <button
            type="button"
            class="btn"
            data-testid="lieutenant-grimoire"
            onclick={() => go(grimoireHref(recommendedTexts![0].id))}
          >
            Ouvrir son grimoire corrompu
          </button>
        {/if}
      </div>

      <section class="recommended">
        <h2>Textes conseillés</h2>
        {#if !recommendedTexts}
          <p class="muted">Lance une quête pour recevoir trois textes conseillés.</p>
        {:else}
          <ul class="text-list">
            {#each recommendedTexts as t (t.id)}
              <li>
                <a class="card text-card" data-testid="lieutenant-text-{t.id}" href={playHref(t)}>
                  <span class="text-title">{t.title}</span>
                  <span class="muted">{t.level} · {t.word_count} mots</span>
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
  .header {
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .portrait {
    position: relative;
    z-index: 1;
    max-height: 180px;
    object-fit: contain;
  }
  .wobble-hover:hover {
    animation: wobble 0.4s ease;
  }
  .technique {
    font-style: italic;
  }
  .eris-line {
    font-style: italic;
    color: var(--violet-dark);
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
  .gauge-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .gauge-label {
    margin: 0;
    font-size: 14px;
  }
  .bar {
    position: relative;
    height: 14px;
    border-radius: 999px;
    background: var(--marble-dark);
    overflow: hidden;
  }
  .rate-bar {
    overflow: visible;
  }
  .bar-fill {
    height: 100%;
    background: var(--olive);
    border-radius: 999px;
    transition: width 0.6s ease;
  }
  .target-marker {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    background: var(--gold);
  }
  .toast {
    color: var(--olive);
    font-weight: 600;
  }
  .actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .reward-line {
    margin: 0;
    font-size: 14px;
  }
  .text-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .text-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-decoration: none;
  }
  .text-title {
    font-family: var(--font-display);
    font-weight: 600;
  }
</style>
