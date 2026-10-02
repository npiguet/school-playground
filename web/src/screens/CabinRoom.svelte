<script lang="ts">
  // The hero's cabin (scenes UI spec §3, UI3 Ruling B6): the trophy shelf opens the rewards
  // (#/p/:id/cabane?panel=tresors), the journal the stats (#/p/:id/stats), the lyre the settings
  // (#/p/:id/settings). Displayed decor hangs on the walls; it reloads when the cabin opens and
  // whenever the shelf puts something on display or away. The hero panel lives here too
  // (#/p/:id/cabane?panel=heros, Ruling B2): the HUD's hero chip is its shortcut from every place.
  // UI3b playability #7: the dragon greets here once per page load and speaks on the shelf's, the
  // journal's and the lyre's voice plates (the hero panel is a short menu, with no plate).
  // The room is the highest house owned: the cabin, the villa or the palais, each with its own
  // places and walls (spec 2026-09-29 drachmes §3, R21).
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Medallion from '../components/juice/Medallion.svelte';
  import TrophiesPanel from '../components/places/cabin/TrophiesPanel.svelte';
  import JournalPanel from '../components/places/cabin/JournalPanel.svelte';
  import LyrePanel from '../components/places/cabin/LyrePanel.svelte';
  import HeroPanel from '../components/places/cabin/HeroPanel.svelte';
  import GuidePanel from '../components/places/cabin/GuidePanel.svelte';
  import { DECOR_SLOTS, cabinGreeting, guideLine, houseScene, journalLine, lyreLine, trophiesLine } from '../lib/world/scenes/cabin';
  import { campFor } from '../lib/world/campStore.svelte';
  import { isAwake } from '../lib/world/eris';
  import { LIEUTENANT_ORDER } from '../lib/world/types';
  import { worldApi } from '../lib/world/api';
  import { ApiError } from '../lib/api';
  import { closePanel, openHotspot } from '../lib/scene/panelNav';
  import { hotspotSelector } from '../lib/scene/hotspotId';
  import { openedFrom } from '../lib/scene/openedFrom.svelte';
  import { OVERLAY_TITLES, sceneHref, type PanelId } from '../lib/world/places';
  import type { HotspotDef } from '../lib/scene/types';
  import type { CampResponse, RewardOut } from '../lib/world/types';
  import type { Profile } from '../lib/types';

  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  let debug = $state(false);
  // The hero's rewards, fetched once here for both the walls and the shelf (final review M15).
  let owned = $state<RewardOut[] | null>(null);
  let rewardsError = $state('');
  // Until /camp answers, the cabin (R21): the places arrive from the camp, which has loaded it.
  const house = $derived(campFor(profile.id)?.house ?? 'cabin');
  const scene = $derived(houseScene(house));
  const slots = $derived(DECOR_SLOTS[house]);
  // One piece per wall slot (4, 6 or 9 by house; the server sets no limit since spec 2026-10-02 house
  // treasures, whose Task 6 stands each piece at its own place): a piece on display beyond the slots
  // stays on the shelf rather than hanging over another.
  const displayed = $derived((owned ?? []).filter((r) => r.kind === 'decor' && r.equipped).slice(0, slots.length));

  // Only the hero id is tracked: the rewards reload for a new hero; a piece the shelf puts on
  // display or away comes back as the server answered it (onUpdated), with no second fetch.
  let generation = 0;
  function loadRewards(id: number) {
    const mine = ++generation;
    owned = null;
    rewardsError = '';
    worldApi
      .rewards(id)
      .then((list) => {
        if (mine === generation) owned = list;
      })
      .catch((e) => {
        if (mine !== generation) return;
        owned = [];
        rewardsError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
      });
  }
  $effect(() => loadRewards(profile.id));
  const updated = (r: RewardOut) => (owned = (owned ?? []).map((x) => (x.id === r.id ? r : x)));

  const dragon = $derived(campFor(profile.id)?.dragon ?? null);
  const greet = (camp: CampResponse | null) => (camp ? cabinGreeting(camp.dragon) : null);
  // Five trophies per lieutenant awake at the class (spec 2026-09-29 lieutenant levels §5); null while /rewards loads.
  const ownedTrophies = $derived(owned === null ? null : owned.filter((r) => r.kind === 'trophy').length);
  const maxTrophies = $derived(5 * LIEUTENANT_ORDER.filter((k) => isAwake(k, profile.level)).length);

  const activate = (def: HotspotDef) => openHotspot(def, profile.id);
  const close = () => closePanel(sceneHref('cabin', profile.id));

  // The journal and the lyre opened from the hero panel give focus back to its medallion when
  // their seal steps back there; opened from the room, to their own hotspot (openedFrom).
  // The guide opened from the lyre gives focus back to « Lire le guide du camp »; coming back from
  // the guide leaves the lyre's own origin (the hero panel) as it was.
  const from = openedFrom(() => panel, ['journal', 'lyre', 'guide'], { lyre: ['guide'] });
</script>

<PlaceScene {profile} {scene} bind:debug {greet}>
  {#snippet children(ctx)}
    {#each displayed as r, i (r.id)}
      {@const slot = slots[i]}
      <div class="cabin-decor" data-testid="cabin-decor-{r.id}" style="left:{slot.x}%;top:{slot.y}%">
        <Medallion rewardId={r.id} size={52} label={r.name} />
      </div>
    {/each}
    {#each scene.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="cabin" onActivate={activate} />
    {/each}
  {/snippet}
</PlaceScene>

{#if panel === 'tresors'}
  <Overlay variant="table" size="wide" title={OVERLAY_TITLES.tresors} testId="overlay-trophies" voice={dragon ? trophiesLine(dragon, ownedTrophies, maxTrophies) : null} onClose={close} returnFocus={hotspotSelector('cabin', 'trophies')}>
    <TrophiesPanel {profile} {owned} {house} loadError={rewardsError} onUpdated={updated} />
  </Overlay>
{:else if panel === 'journal'}
  <Overlay variant="codex" title={OVERLAY_TITLES.journal} testId="overlay-journal" voice={dragon ? journalLine(dragon) : null} onClose={close} returnFocus={from.of('journal') === 'heros' ? '[data-testid="hero-journal"]' : hotspotSelector('cabin', 'journal')}>
    <JournalPanel {profile} />
  </Overlay>
{:else if panel === 'lyre'}
  <Overlay variant="scroll" title={OVERLAY_TITLES.lyre} testId="overlay-lyre" voice={dragon ? lyreLine(dragon) : null} onClose={close} returnFocus={from.of('lyre') === 'heros' ? '[data-testid="hero-settings"]' : hotspotSelector('cabin', 'lyre')}>
    <LyrePanel {profile} />
  </Overlay>
{:else if panel === 'guide'}
  <!-- Spec 2026-09-29 explanations §3 (R12): opened from the lyre, its seal steps back there. -->
  <Overlay variant="codex" title={OVERLAY_TITLES.guide} testId="overlay-guide" voice={dragon ? guideLine(dragon) : null} onClose={close} returnFocus={from.of('guide') === 'lyre' ? '[data-testid="lyre-guide"]' : hotspotSelector('cabin', 'lyre')}>
    <GuidePanel />
  </Overlay>
{:else if panel === 'heros'}
  <Overlay variant="scroll" title={OVERLAY_TITLES.heros} testId="overlay-heros" onClose={close} returnFocus={'[data-testid="hud-hero"]'}>
    <HeroPanel {profile} />
  </Overlay>
{/if}

<style>
  .cabin-decor {
    position: absolute;
    z-index: 2;
    transform: translate(-50%, -50%);
    pointer-events: none;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
  }
</style>
