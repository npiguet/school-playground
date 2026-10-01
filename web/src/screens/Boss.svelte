<script lang="ts">
  // The boss fight against Éris herself (spec §3.6, plan Decisions 8 & 19), on the battle stage in
  // her lair (UI4). A lost fight never costs anything - the button always reads "Affronter Éris"
  // again, the quest stays active - so this screen never needs a "you lost" state of its own; the
  // victory phase handles that.
  import { untrack } from 'svelte';
  import BattleStage from '../components/battle/BattleStage.svelte';
  import BossMuster from '../components/battle/BossMuster.svelte';
  import { rulesOf } from '../lib/rules';
  import { battleFor } from '../lib/battle/battle';
  import { CHALLENGE_AGAIN, CHALLENGE_LINES } from '../lib/battle/lines';
  import { initAudioSettings } from '../lib/audio/store.svelte';
  import { worldApi } from '../lib/world/api';
  import { campFor, campStore, refreshCamp, loadCatalog } from '../lib/world/campStore.svelte';
  import { bossRewardId as rewardIdFor, bossRewardName, bossTier } from '../lib/world/rewards';
  import { erisSays } from '../lib/world/voices';
  import { ApiError } from '../lib/api';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  // The stage's HUD needs the hero's mute setting, like every place. As in PlaceScene (final review
  // I2), this depends on the profile id only: loadCatalog() reads campStore.catalog and initAudioSettings()
  // reads profile.settings, and tracking either would fetch /camp again when they change. A derived
  // id (UI4 M6): reading `profile.id` in the effect would track the whole `profile` prop, and a new
  // profile object for the same hero (loadProfile) would fetch again.
  const heroId = $derived(profile.id);
  $effect(() => {
    const id = heroId;
    untrack(() => {
      initAudioSettings(profile);
      void refreshCamp(id);
      void loadCatalog();
    });
  });

  // This hero's camp snapshot only (final review I2): the store is shared across heroes.
  const camp = $derived(campFor(profile.id));
  const tier = $derived(bossTier(camp) ?? 1);
  const bossRewardId = $derived(rewardIdFor(tier, campStore.catalog));
  const battle = battleFor('eris', { mode: 'boss', encounter: 'eris' });

  let starting = $state(false);
  let startError = $state('');

  async function start() {
    starting = true;
    startError = '';
    try {
      const { quest, text_id } = await worldApi.boss(profile.id);
      const params = { profileId: String(profile.id), textId: String(text_id) };
      // Spec 2026-09-29 §2: always the dictation; a clean copy simply wins (the old Grimoire retry is gone).
      navigate(href('play', params, { quest: String(quest.id), encounter: 'eris' }));
    } catch (e) {
      startError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      starting = false;
    }
  }
</script>

<BattleStage {battle} phase="muster" {profile} {camp} mode="boss" dragon={camp?.dragon ?? null} hud exit hug>
  {#snippet children()}
    <BossMuster
      {tier}
      rewardId={bossRewardId}
      rewardXp={campStore.catalog?.quest_bonus.boss ?? 300}
      rewardDrachmes={rulesOf(campStore.catalog).drachmes.boss}
      rewardName={bossRewardId ? bossRewardName(tier, campStore.catalog) : null}
      fightMax={rulesOf(campStore.catalog).fight_max_per_100}
      {starting}
      {startError}
      taunt={erisSays(CHALLENGE_LINES[tier] ?? CHALLENGE_AGAIN[(tier - 4) % CHALLENGE_AGAIN.length] ?? CHALLENGE_LINES[1])}
      onStart={start}
    />
  {/snippet}
</BattleStage>
