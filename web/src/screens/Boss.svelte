<script lang="ts">
  // The boss fight against Éris herself (spec §3.6, plan Decisions 8 & 19). A lost fight never
  // costs anything - the button always reads "Affronter Éris" again, the quest stays active - so
  // this screen never needs a "you lost" state of its own; Results.svelte handles that.
  import TopBar from '../components/TopBar.svelte';
  import Dragon from '../components/Dragon.svelte';
  import Medallion from '../components/juice/Medallion.svelte';
  import { ART } from '../lib/world/art';
  import { worldApi } from '../lib/world/api';
  import { campStore, refreshCamp, loadCatalog } from '../lib/world/campStore.svelte';
  import { romanTier } from '../lib/world/quests';
  import { ApiError } from '../lib/api';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  $effect(() => {
    void refreshCamp(profile.id);
    void loadCatalog();
  });

  const activeBossQuest = $derived(campStore.data?.quests.find((q) => q.kind === 'boss' && q.status === 'active') ?? null);
  const tier = $derived(campStore.data?.boss.tier_available ?? activeBossQuest?.goal.tier ?? 1);
  const dragonStage = $derived(campStore.data?.dragon.stage ?? 'egg');
  const dragonTint = $derived(campStore.data?.dragon.tint ?? 'bronze');
  // P1-5 follow-up (controller ruling): after a too_easy draw the active boss quest is flagged
  // 'grimoire' server-side - the retry has to run as a Grimoire corrompu session on the same
  // (already-longest) text instead of plain dictation, since "reviens avec un texte plus long"
  // was never actually possible.
  const isGrimoireRetry = $derived(activeBossQuest?.goal.mode === 'grimoire');

  const CHALLENGE_LINES: Record<number, string> = {
    1: '« Deux de mes ruses réduites au silence ? Voyons si mes pièges tiennent quand ils jouent tous ensemble. »',
    2: '« Encore toi. Cette fois mes pièges sont mieux cachés, et le texte est long. Très long. »',
    3: "« Le Grand Désaccord. Toutes mes ruses, un seul texte, et la pomme d'or en jeu. Après ça, je ne reviendrai pas. (Si.) »",
  };

  function bossRewardName(): string {
    const rewardId = campStore.catalog?.boss_rewards[String(tier)];
    return (rewardId ? campStore.catalog?.rewards[rewardId]?.name : undefined) ?? 'une récompense';
  }

  const bossRewardId = $derived(campStore.catalog?.boss_rewards[String(tier)] ?? null);

  let starting = $state(false);
  let startError = $state('');

  async function start() {
    starting = true;
    startError = '';
    try {
      const { quest, text_id, help_stage } = await worldApi.boss(profile.id);
      const params = { profileId: String(profile.id), textId: String(text_id) };
      const query = { quest: String(quest.id), encounter: 'eris', help: String(help_stage) };
      // A grimoire-flagged retry (P1-5 follow-up) opens the 'grimoire' route instead of 'play':
      // Play.svelte then corrupts the same text server-side (POST /corrupt) rather than dictating
      // it, so there's always something real to catch.
      navigate(href(quest.goal.mode === 'grimoire' ? 'grimoire' : 'play', params, query));
    } catch (e) {
      startError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      starting = false;
    }
  }
</script>

<TopBar {profile} title="Éris" />

<div class="screen boss">
  <div class="scene battlefield" style="background-image:url({ART.scenes.battle})">
    <span class="combatant dragon">
      <Dragon stage={dragonStage} tint={dragonTint} size={260} mood="idle" />
    </span>
    <img src={ART.erisSmug} alt="Éris" class="combatant eris" />
  </div>

  <div class="parchment eris-panel challenge">
    <p class="challenge-line">{CHALLENGE_LINES[tier] ?? CHALLENGE_LINES[1]}</p>
  </div>

  <div class="card info-card">
    <p class="tier" data-testid="boss-tier">Combat {romanTier(tier)}</p>
    <div class="reward" data-testid="boss-reward">
      {#if bossRewardId}<Medallion rewardId={bossRewardId} kind="gear" size={40} />{/if}
      <span>Récompense si tu gagnes : {campStore.catalog?.quest_bonus.boss ?? 300} XP · {bossRewardName()}</span>
    </div>
    <p class="rules muted">
      Un long texte · les Yeux d'Argus restent éteints · chaque piège trouvé reste acquis, même si Éris s'enfuit : tu
      pourras recommencer.
    </p>

    {#if startError}<p class="orange" role="alert">{startError}</p>{/if}

    <button type="button" class="btn btn-primary" data-testid="boss-start" disabled={starting} onclick={start}>
      {isGrimoireRetry ? 'Relancer le combat' : 'Affronter Éris'}
    </button>
  </div>
</div>

<style>
  .boss {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .battlefield {
    height: 40vh;
    min-height: 260px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 16px;
  }
  .combatant {
    position: relative;
    z-index: 1;
    object-fit: contain;
    display: flex;
  }
  .combatant.dragon {
    max-height: 40vh;
  }
  .combatant.eris {
    max-height: 100%;
  }
  .challenge {
    padding: 18px 20px;
  }
  .challenge-line {
    margin: 0;
    font-style: italic;
    font-size: 18px;
  }
  .info-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .tier {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 20px;
  }
  .reward {
    margin: 0;
    font-weight: 600;
    color: var(--gold);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .rules {
    margin: 0;
  }
</style>
