<script lang="ts">
  // The camp as a hub scene on hub_camp.webp (scenes UI spec §3 "Hub scene", UI3 Ruling B3): the
  // painted camp with its six places (CAMP_SCENE hotspots, each routing to its place), the slim HUD,
  // the weekly goal banner and the dragon's greeting. The hero panel lives in the cabin: `?panel=heros`
  // (plan Ruling 6) hands over to it (UI3 Ruling B2). Built on PlaceScene like every other place (final
  // review M2): the data load, the HUD, the greeting and the "camp unreachable" state are shared; what
  // is the camp's own is the dragon in its nest, the ribbon, the locked path to battle explaining
  // itself, the fade out to the next scene and having no exit sign (it is where the others lead).
  // Final review I3 (sub-project 3): a dragon that grew while she was away (its stage beyond the one
  // she last saw, lib/world/dragonSeen.svelte.ts) is revealed once, on a scroll, before the greeting.
  // Hermès's stall opens here as an overlay (`?panel=etal`, spec 2026-09-29 drachmes §2).
  import { untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import SceneLayer from '../components/scene/SceneLayer.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Dragon from '../components/Dragon.svelte';
  import DragonNameAsk from '../components/DragonNameAsk.svelte';
  import StallPanel from '../components/places/camp/StallPanel.svelte';
  import { sayKey } from '../lib/dialogue/select';
  import type { ItemKind } from '../lib/world/shop';
  import { CAMP_SCENE, bossLockLine, campDragonLayer, campGreeting, campScene, weeklyCaption } from '../lib/world/scenes/camp';
  import { dragonSays } from '../lib/world/scenes/speakers';
  import { campFor } from '../lib/world/campStore.svelte';
  import { dragonRevealFor, markDragonSeen, type CampReveal } from '../lib/world/dragonSeen.svelte';
  import { markShopSeen, shopSeenFor } from '../lib/world/shopSeen.svelte';
  import { whatNext } from '../lib/world/nextStep';
  import { overlayState } from '../lib/scene/overlayState.svelte';
  import { VICTORY } from '../lib/battle/lines';
  import { TINT_FILTERS, dragonCaption } from '../lib/world/dragon';
  import { ART } from '../lib/world/art';
  import { accessoryLayers } from '../lib/world/accessories';
  import type { CampResponse } from '../lib/world/types';
  import type { DialogueLine, HotspotDef, SceneLayerDef } from '../lib/scene/types';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { reducedMotion } from '../lib/juice/motion';
  import { navigate } from '../lib/router.svelte';
  import { closePanel, go, heroPanelHref, hotspotHref, openPanel, replacePanel } from '../lib/scene/panelNav';
  import { hotspotSelector } from '../lib/scene/hotspotId';
  import { shouldTour } from '../lib/tours/seen.svelte';
  import { OVERLAY_TITLES, sceneHref, type PanelId } from '../lib/world/places';
  import type { Profile } from '../lib/types';

  // `panel` comes from placeFor, like every other place (final review M2).
  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  // SceneStage owns the ?debug flag and hands it back through PlaceScene.
  let debug = $state(false);
  let place: PlaceScene | undefined = $state();
  // Spec 2026-10-02 nest by stage: the camp warms the nest painting of the dragon's stage.
  const scene = $derived(campScene(campFor(profile.id)?.dragon.stage ?? null));

  // Final review I3: what the camp would reveal of the dragon now (null once seen), and the reveal on
  // show. It waits for the camp tour and any open overlay (one modal at a time), and never opens under
  // ?debug or on the way to a deep-linked panel. Frozen once open: naming the dragon in it must not
  // take the name field away mid-sentence.
  const pending = $derived.by(() => {
    const camp = campFor(profile.id);
    return camp ? dragonRevealFor(profile, camp.dragon) : null;
  });
  let reveal = $state<CampReveal | null>(null);
  $effect(() => {
    if (reveal || !pending || debug || panel !== null || shouldTour(profile, 'camp') || overlayState.open > 0) return;
    reveal = pending;
  });
  function closeReveal() {
    const shown = reveal;
    if (!shown) return;
    void markDragonSeen(profile, shown.stage);
    reveal = null;
  }

  // The dragon greets once the camp data is there; a new hero's first visit is the camp tour instead
  // (PlaceScene holds the greeting while it runs, UI5 Ruling E13). A reveal to show comes first: the
  // greeting (which asks for a name the reveal may just have given) waits for it to close.
  // SP4 final review I1: a greeting that names Hermès's stall records the pieces it named, so the same
  // pieces are not named again (Hermès never pushes); a newly affordable one names it once more.
  function greet(camp: CampResponse | null): DialogueLine[] | null {
    if (!camp || pending || reveal) return null;
    const seen = shopSeenFor(profile);
    const lines = campGreeting(profile.name, camp, seen);
    if (whatNext(camp, seen).kind === 'shop') {
      const named = camp.affordable;
      untrack(() => void markShopSeen(profile, named));
    }
    return lines;
  }

  function dragonLayer(camp: CampResponse): SceneLayerDef {
    return { id: 'dragon', src: ART.dragon[camp.dragon.stage], alt: dragonCaption(camp.dragon), ...campDragonLayer(camp.dragon.stage) };
  }

  // Playability #12: leaving the hub fades through the night before the next screen appears
  // (App.svelte fades the dark back out on arrival).
  // Idempotent, and the timer dies with the camp: a browser Back inside the fade must not be
  // overridden by a navigation that was still pending (fix wave 2).
  let leaving = $state(false);
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => () => clearTimeout(leaveTimer));
  // `panel`: an overlay of another place (the hero panel from the HUD chip) opens as a tagged
  // push, so its seal steps back to the camp (the cross-place overlay rule, panelNav.ts `go`).
  function leaveTo(path: string, mode: 'push' | 'panel' = 'push') {
    if (leaving) return;
    leaving = true;
    leaveTimer = setTimeout(() => (mode === 'panel' ? openPanel(path) : navigate(path)), reducedMotion() ? 60 : 180);
  }

  function openHero(path: string) {
    unlockAudio();
    playSfx('tap');
    leaveTo(path, 'panel');
  }

  // The tap sounds at once; the navigation waits for the fade (so not `go()`, which navigates now).
  function activate(def: HotspotDef) {
    const to = hotspotHref(def, profile.id);
    if (!to) return;
    // Spec 2026-09-29 drachmes §2 (R10): the stall is an overlay of the camp: no night fade, no
    // leaving (`go` plays the tap). Any camp hotspot with a `query.panel` is taken to be an overlay
    // of the camp itself (today only the stall's `?panel=etal`): a hotspot leading to another
    // place's overlay must not set one, or it would skip the fade out of the camp.
    if (def.query?.panel) {
      go(to, 'panel');
      return;
    }
    unlockAudio();
    playSfx('tap');
    leaveTo(to);
  }

  // Hermès speaks on the stall's voice plate: his welcome, then his thanks after a purchase (R13).
  let stallVoice = $state<DialogueLine | null>(null);
  $effect(() => {
    if (panel === 'etal') stallVoice = untrack(() => sayKey('stall.enter'));
  });
  const bought = (kind: ItemKind) => (stallVoice = sayKey(`stall.bought.${kind}`));
  const closeStall = () => closePanel(sceneHref('camp', profile.id));

  // UI3 Ruling B3, carry #16/M9: the locked path to battle says how many tricks remain, in the
  // dragon's words. The tap on the locked path never takes the stage's one-tap guard (Hotspot.svelte).
  function explainLocked() {
    const camp = campFor(profile.id);
    if (!camp) return;
    unlockAudio();
    place?.say([dragonSays(camp.dragon, bossLockLine(camp))], hotspotSelector('camp', 'boss'));
  }

  // UI3 Ruling B2: `?panel=heros` stays a route; once the camp tour is over (fix wave 3: one modal
  // at a time, the tour first) it hands over to the hero panel in the cabin. shouldTour reads a
  // SvelteSet, so this runs again as soon as the tour ends. replacePanel keeps a tagged entry
  // tagged, so the panel's seal still steps back to where it was opened.
  $effect(() => {
    if (panel === 'heros' && !shouldTour(profile, 'camp')) replacePanel(heroPanelHref(profile.id));
  });
</script>

<PlaceScene bind:this={place} {profile} {scene} bind:debug showExit={false} {greet} onHero={openHero}>
  {#snippet children(ctx)}
    {#if ctx.camp}
      <SceneLayer
        layer={dragonLayer(ctx.camp)}
        filter={TINT_FILTERS[ctx.camp.dragon.tint]}
        overlays={accessoryLayers(ctx.camp.dragon.worn, ctx.camp.dragon.stage)}
        testId="camp-dragon-layer"
      />
    {/if}

    {#each CAMP_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="camp" onActivate={activate} onLocked={explainLocked} />
    {/each}

    {#if ctx.camp}
      <!-- Playability #6, #7: a cloth ribbon under the « Le camp » plaque, in-world words,
           and three leaves that fill in as the week's parchments are defended. -->
      <p class="weekly stage-text" data-testid="camp-weekly">
        <span class="leaves" aria-hidden="true">
          {#each Array.from({ length: ctx.camp.weekly.target }, (_, i) => i) as i (i)}<span
              class="leaf"
              class:filled={i < ctx.camp.weekly.done}
            ></span>{/each}
        </span>
        <span>{weeklyCaption(ctx.camp.weekly)}</span>
      </p>
    {/if}
  {/snippet}
</PlaceScene>

{#if panel === 'etal'}
  <Overlay variant="table" size="wide" title={OVERLAY_TITLES.etal} testId="overlay-stall" voice={stallVoice} onClose={closeStall} returnFocus={hotspotSelector('camp', 'stall')}>
    <StallPanel {profile} onBought={bought} />
  </Overlay>
{/if}

{#if reveal}
  {@const dragon = campFor(profile.id)?.dragon}
  <Overlay variant="scroll" title="Ton dragon" testId="camp-dragon-reveal" onClose={closeReveal}>
    <div class="dragon-reveal">
      <Dragon stage={reveal.stage} tint={dragon?.tint ?? 'bronze'} mood="happy" size={160} name={dragon?.name} worn={dragon?.worn ?? []} />
      <p class="reveal-line" data-testid="camp-reveal-line">{reveal.line}</p>
      {#if reveal.askName}
        <DragonNameAsk profileId={profile.id} testPrefix="camp-reveal" ownKeyboard={false} />
      {/if}
      <button type="button" class="kit-bronze" data-testid="camp-reveal-continue" onclick={closeReveal}>{VICTORY.continue}</button>
    </div>
  </Overlay>
{/if}

{#if leaving}
  <div class="exit-veil" data-testid="exit-veil" aria-hidden="true" in:fade={{ duration: 180 }}></div>
{/if}

<style>
  /* The weekly ribbon (playability #7): under the « Le camp » plaque (top 9.5 %), in the
     open sky of hub_camp.webp (docs/art/scenes.md: x 40-65, y 8-20), clear of every place and
     plaque (scenes-camp.spec.ts measures it). Centred at x 51.5 %, top 16 %, with slimmer notched
     ends: at 1280x720 (the widest ribbon in art %, five leaves) it clears the temple's box (right
     edge x 36) and ends above the battle arch's (top y 22), at least 4 px clear of both at every
     size. Notched cloth ends, not the pill of a toast notification. */
  .weekly {
    position: absolute;
    left: 51.5%;
    top: 16%;
    transform: translateX(-50%);
    z-index: 3;
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 6px 20px;
    white-space: nowrap;
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--bronze-ink);
    background: linear-gradient(180deg, #5b3d26, #3e2818 60%, #33200f);
    box-shadow:
      inset 0 2px 0 rgba(200, 148, 80, 0.55),
      inset 0 -2px 0 rgba(200, 148, 80, 0.55);
    clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 0 100%, 14px 50%);
    filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35));
  }
  .leaves {
    display: inline-flex;
    gap: 3px;
  }
  .leaf {
    width: 10px;
    height: 16px;
    box-sizing: border-box;
    border-radius: 100% 0;
    border: 1px solid rgba(200, 148, 80, 0.8);
    background: rgba(200, 148, 80, 0.12);
    transform: rotate(-30deg);
  }
  .leaf.filled {
    border-color: var(--bronze-dark);
    background: linear-gradient(135deg, var(--gold-light), var(--gold));
  }
  /* The reveal's scroll: the dragon at its new stage, the news, its name if it has none. */
  .dragon-reveal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  .reveal-line {
    margin: 0;
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    color: var(--reward-ink);
  }
  .exit-veil {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: var(--night);
  }
</style>
