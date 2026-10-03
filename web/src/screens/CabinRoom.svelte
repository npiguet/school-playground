<script lang="ts">
  // The hero's cabin (scenes UI spec §3, UI3 Ruling B6): the trophy shelf opens the rewards
  // (#/p/:id/cabane?panel=tresors), the journal the stats (#/p/:id/stats), the lyre the settings
  // (#/p/:id/settings). Each lieutenant's highest trophy, and the gear and decor on display, stand
  // at their own place in the room (spec 2026-10-02 house treasures); the rewards load when the room
  // opens and follow the shelf's « Exposer » / « Ranger ». The hero panel lives here too
  // (#/p/:id/cabane?panel=heros, Ruling B2): the HUD's hero chip is its shortcut from every place.
  // UI3b playability #7: the dragon greets here once per page load and speaks on the shelf's, the
  // journal's and the lyre's voice plates (the hero panel is a short menu, with no plate).
  // The room is the highest house owned: the cabin, the villa or the palais, each with its own
  // places (spec 2026-09-29 drachmes §3, R21).
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import TrophiesPanel from '../components/places/cabin/TrophiesPanel.svelte';
  import JournalPanel from '../components/places/cabin/JournalPanel.svelte';
  import LyrePanel from '../components/places/cabin/LyrePanel.svelte';
  import HeroPanel from '../components/places/cabin/HeroPanel.svelte';
  import GuidePanel from '../components/places/cabin/GuidePanel.svelte';
  import { cabinGreeting, guideLine, houseScene, journalLine, lyreLine, trophiesLine } from '../lib/world/scenes/cabin';
  import { PIECE_IDS, TREASURE_PLACES, shownPieces } from '../lib/world/scenes/treasures';
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
  // The hero's rewards, fetched once here for both the room and the shelf (final review M15).
  let owned = $state<RewardOut[] | null>(null);
  let rewardsError = $state('');
  // Until /camp answers, the cabin (R21): the places arrive from the camp, which has loaded it.
  const house = $derived(campFor(profile.id)?.house ?? 'cabin');
  const scene = $derived(houseScene(house));
  // What stands in the room: nothing while /rewards loads or after it failed (the fixtures only),
  // then each piece at the places of the house the camp names.
  const pieces = $derived(owned === null ? [] : shownPieces(house, owned));

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
    {#each pieces as p (p.id)}
      <div
        class="piece {p.pose}"
        data-testid="cabin-piece-{p.id}"
        data-level={p.level ?? undefined}
        style="left:{p.place.x - p.place.w / 2}%;top:{p.place.y}%;width:{p.place.w}%;--foot:{p.foot}"
      >
        <img src={p.src} alt="" width={p.size.w} height={p.size.h} decoding="async" draggable="false" />
      </div>
    {/each}
    {#if debug}
      <!-- ?debug: every place's bottom edge and width, owned or not, to check them on the painting. -->
      {#each PIECE_IDS as id (id)}
        {@const pl = TREASURE_PLACES[house][id]}
        <div class="place-debug" data-testid="cabin-place-{id}" style="left:{pl.x - pl.w / 2}%;top:{pl.y}%;width:{pl.w}%">
          <span>{id}</span>
        </div>
      {/each}
    {/if}
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
  /* A piece at its place (spec 2026-10-02 house treasures): its box's bottom edge on the place's
     line (a trophy sits its transparent foot lower), its width the place's, its height its picture's;
     under the hotspots (z 3) and their plaques, not tappable, still (no depth, idle or parallax). */
  .piece {
    position: absolute;
    z-index: 2;
    transform: translateY(calc(-100% + var(--foot) * 100%));
    pointer-events: none;
  }
  .piece img {
    display: block;
    width: 100%;
    height: auto;
  }
  /* The contact shadow under a standing piece (CSS, not painted, ruling R3): a soft ellipse on its
     base line. */
  .piece:is(.trophy, .stands)::after {
    content: '';
    position: absolute;
    left: 12%;
    right: 12%;
    bottom: calc(var(--foot) * 100%);
    aspect-ratio: 6 / 1;
    transform: translateY(50%);
    background: radial-gradient(closest-side, rgba(20, 12, 6, 0.45), rgba(20, 12, 6, 0));
    z-index: -1;
  }
  /* A trophy's picture is a square around a narrow statuette: a narrower shadow. */
  .piece.trophy::after {
    left: 28%;
    right: 28%;
  }
  /* A hanging piece: a faint drop shadow, so it sits on the wall; the rug lies flat with none. */
  .piece.hangs img {
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
  }
  .place-debug {
    position: absolute;
    z-index: 4;
    border-top: 2px dashed #ffe14d;
    pointer-events: none;
  }
  .place-debug span {
    position: absolute;
    bottom: 2px;
    left: 0;
    font-size: 10px;
    color: #ffe14d;
    text-shadow: 0 0 2px #000;
    white-space: nowrap;
  }
</style>
