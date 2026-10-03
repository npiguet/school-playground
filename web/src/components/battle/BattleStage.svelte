<script lang="ts">
  // The battle stage (scenes spec §5, UI4 Rulings C4, C5, C10, C12): full-screen backdrop, the dragon
  // on the left, the opponent on the right, its hold bar, and the parchment in the middle, laid out in
  // viewport space so the text keeps its size. While the keyboard is open (visual viewport shorter
  // than 560 px) the scene folds into a band above the parchment. Test ids and attributes mirror
  // SceneStage's (`scene-battle`, `stage-hud`, `data-reduced-motion`, SceneTransition's
  // `data-settled`), so the scene e2e helpers work here too.
  import { onMount, type Snippet } from 'svelte';
  import SceneTransition from '../scene/SceneTransition.svelte';
  import FxCanvas from '../scene/FxCanvas.svelte';
  import Hud from '../scene/Hud.svelte';
  import SceneExit from '../scene/SceneExit.svelte';
  import RotateScreen from '../scene/RotateScreen.svelte';
  import Particles from '../juice/Particles.svelte';
  import Combatant from './Combatant.svelte';
  import HpBar from './HpBar.svelte';
  import { FACES, type BattleDef, type BattleMode, type BattlePhase } from '../../lib/battle/battle';
  import { bandHeight, battleLayout, type BattleLayout } from '../../lib/battle/layout';
  import { battleStage, resetBattleStage } from '../../lib/battle/stage.svelte';
  import { viewport, watchViewport } from '../../lib/battle/viewport.svelte';
  import { emitBattle } from '../../lib/battle/events';
  import { EMPRISE, STAGE } from '../../lib/battle/lines';
  import { overlayState } from '../../lib/scene/overlayState.svelte';
  import { go, heroPanelHref } from '../../lib/scene/panelNav';
  import { reducedMotion, watchReducedMotion } from '../../lib/juice/motion';
  import { ART } from '../../lib/world/art';
  import { accessoryLayers } from '../../lib/world/accessories';
  import { FOE_ASPECT, foeRigFor, livingFoe, livingStage } from '../../lib/living/stages';
  import type { CampResponse, DragonOut } from '../../lib/world/types';
  import type { Profile } from '../../lib/types';

  let {
    battle,
    phase,
    profile,
    camp,
    dragon,
    mode = 'dictation',
    hud = false,
    exit = false,
    hug = false,
    onExit,
    children,
    overlay,
  }: {
    battle: BattleDef | null;
    phase: BattlePhase;
    mode?: BattleMode;
    profile: Profile;
    camp: CampResponse | null;
    dragon: DragonOut | null;
    hud?: boolean;
    exit?: boolean;
    /** A short muster (Éris's lair, the grimoire, the resume ribbon): the parchment hugs its content,
     *  centred, and the backdrop shows around it (UI4 playability #14). Full layout only. */
    hug?: boolean;
    /** Runs as « Le camp » is tapped, before it leaves (the victory drops its saved results, M2). */
    onExit?: () => void;
    /** The phase on the parchment, given the layout and the stage's reduced-motion setting (one
     *  watcher for the whole battle, M15). */
    children: Snippet<[BattleLayout, boolean]>;
    /** The stage's overlays (the « Revoir » scroll): rendered next to the stage, outside the `<main>`
     *  that turns `inert` while they are open, as the places render theirs next to SceneStage. */
    overlay?: Snippet;
  } = $props();

  resetBattleStage();
  let reduced = $state(reducedMotion());
  $effect(() => watchReducedMotion((r) => (reduced = r)));
  onMount(() => watchViewport());

  const layout = $derived<BattleLayout>(
    viewport.height > 0 ? battleLayout(viewport.height, viewport.inner, viewport.scale) : 'full',
  );
  const compact = $derived(layout === 'compact');
  const band = $derived(bandHeight(viewport.height || 820));
  const covered = $derived(overlayState.open > 0);
  // Ruling C12: the particles drift only while no text is read or written: the muster and the victory
  // (M14, the TTS runs on an iPad). The combatants live in every phase (spec 2026-10-03 living battle,
  // plan Ruling B7).
  const idle = $derived(phase === 'muster' || phase === 'victory');
  // Ruling C4 / I4: in compact the HUD and « Le camp » fold into the band (a control may move, never
  // disappear); in full they keep their places.
  const bandTools = $derived(compact && (hud || exit));
  const dragonStage = $derived(dragon?.stage ?? 'egg');
  // UI4 Task A: Éris's routed pose - a sore loser caught off guard - replaces her standing card once
  // her `defeat` reaction plays, on top of the boss card the muster already showed; she has her own rig
  // for it (spec 2026-10-03 living battle, plan Ruling B6).
  const flustered = $derived(battle?.opponent.id === 'eris' && battleStage.opponent.reaction === 'defeat');
  const opponentArt = $derived(flustered ? ART.erisFlustered : (battle?.opponent.art ?? ''));
  // Both fighters alive (plan Rulings B7, B8): the dragon's stage (never the egg) and the opponent's
  // rig, none under reduced motion.
  const dragonLiving = $derived(reduced ? null : livingStage(dragonStage));
  const opponentLiving = $derived(reduced || !battle ? null : livingFoe(foeRigFor(battle.opponent.id, flustered)));

  $effect(() => {
    if (battle) emitBattle({ kind: 'start', opponent: battle.opponent.id, mode, backdrop: battle.backdrop.id });
  });
  $effect(() => emitBattle({ kind: 'phase', phase }));

  const onHero = () => go(heroPanelHref(profile.id), 'panel');
</script>

<!-- The visual viewport's height and offset are written on the stage, and only in compact, where
     they place it (M13): a pan never restyles the whole document. -->
<main
  class="battle-stage"
  class:has-overlay={covered}
  class:has-hud={hud && !compact}
  class:has-exit={exit && !compact}
  class:band-tools={bandTools}
  data-testid="scene-battle"
  data-phase={phase}
  data-layout={layout}
  data-opponent={battle?.opponent.id ?? ''}
  data-backdrop={battle?.backdrop.id ?? ''}
  data-reduced-motion={reduced ? 'true' : 'false'}
  inert={covered}
  style:--band="{band}px"
  style:--vvh={compact ? `${viewport.height}px` : undefined}
  style:--vv-top={compact ? `${viewport.top}px` : undefined}
>
  <SceneTransition kind="fade">
    <div class="battle-scene" data-testid="battle-scene">
      {#if battle}
        <img class="battle-backdrop" src={battle.backdrop.src} alt="" draggable="false" />
        {#if !reduced && layout === 'full' && idle}<FxCanvas preset={battle.ambience.particles} />{/if}
        <!-- A new opponent or a new battle (resetBattleStage) mounts fresh combatants, so a held
             end pose (defeat, retreat) never carries over into a replay. -->
        {#key `${battle.opponent.id}:${battleStage.generation}`}
          <!-- The dragon waits for the camp: an egg standing in for a grown dragon would flash. -->
          {#if dragon}
            <Combatant
              src={ART.dragon[dragonStage]}
              alt={dragon.name ?? STAGE.dragonAlt}
              side="left"
              mirror={FACES.dragon[dragonStage] !== 'right'}
              tint={dragon.tint}
              overlays={accessoryLayers(dragon.worn, dragonStage)}
              reaction={battleStage.dragon.reaction}
              nonce={battleStage.dragon.nonce}
              testId="battle-dragon"
              living={dragonLiving}
              aspect={1}
              {reduced}
            />
          {/if}
          <Combatant
            src={opponentArt}
            alt={battle.opponent.alt}
            side="right"
            mirror={FACES[battle.opponent.id] !== 'left'}
            reaction={battleStage.opponent.reaction}
            nonce={battleStage.opponent.nonce}
            hits={battleStage.hits}
            testId="battle-opponent"
            living={opponentLiving}
            aspect={FOE_ASPECT}
            {reduced}
          />
          <!-- Particles fires on mount too: it mounts with the first strike, never before. -->
          {#if battleStage.hits > 0}
            <div class="hit-burst" aria-hidden="true"><Particles trigger={battleStage.hits} kind="burst" /></div>
          {/if}
        {/key}
        <div class="hp-slot"><HpBar name={battle.opponent.name} label={EMPRISE[battle.opponent.id]} hp={battleStage.hp} /></div>
      {/if}
      {#if bandTools}
        <div class="band-hud" data-testid="band-hud">
          {#if hud}
            <Hud {profile} {camp} {onHero} band>
              {#snippet lead()}{#if exit}<SceneExit profileId={profile.id} {onExit} />{/if}{/snippet}
            </Hud>
          {:else}
            <SceneExit profileId={profile.id} {onExit} />
          {/if}
        </div>
      {/if}
    </div>
    <!-- No name of its own (M22): the phase's heading says what the parchment holds. -->
    <section class="battle-parchment" class:hug={hug && !compact} data-testid="battle-parchment">
      {@render children(layout, reduced)}
    </section>
    {#if exit && !compact}<SceneExit profileId={profile.id} {onExit} />{/if}
  </SceneTransition>
  <div class="stage-hud" data-testid="stage-hud">
    {#if hud && !compact}<Hud {profile} {camp} {onHero} />{/if}
  </div>
  <RotateScreen background={battle?.backdrop.src ?? null} />
</main>
{@render overlay?.()}

<style>
  .battle-stage {
    position: fixed;
    inset: 0;
    overflow: hidden; /* fallback for engines without `clip` */
    overflow: clip;
    background: var(--night);
    --parchment-w: min(62vw, 48rem);
    --side: calc((100vw - var(--parchment-w)) / 2);
    --top: calc(12px + env(safe-area-inset-top));
    /* Spec 2026-10-03 living battle, plan Ruling B9: each fighter fills its side column and may tuck
       under the parchment's edge (drawn above it) by a bounded share of its box, measured on the
       pictures (living-battle.spec.ts, at 1280x720, 1366x1024 and 1024x640). The opponent faces the
       parchment with what it holds (Éris's apple, the Hydre's and the Chimère's snake heads, Protée's
       trident, the Sirènes' lyre reach to 5 % of its box on that side): it tucks its transparent margin
       only, 3 % of a box 585 / 1024 as wide as high, 1.8 = 1 / (0.5713 x 0.97). The dragon faces it
       with its snout (the ancestral's beard reaches 81 % of its box): it tucks 15 % at most, 1.176 =
       1 / 0.85, and never less than its size before this spec (clamp(140px, 36vh, 320px), which binds
       at 1024x640: 15.5 %). Neither is ever smaller than before (Ruling B14 over the 3 %): where the
       column is narrow for the screen's height (1180x820, 1024x768) the opponent keeps its old size,
       clamp(180px, 50vh, 440px), and tucks what that size implies, as it did. The height caps keep the opponent under the hold bar and both under the
       HUD. The dragon's floor may push its box off the left edge instead (Ruling B15, below). */
    --feet: calc(4vh + env(safe-area-inset-bottom));
    --dragon-feet: var(--feet);
    --hold-room: 96px;
    --foe-h: min(max(clamp(180px, 50vh, 440px), calc((var(--side) - 8px) * 1.8)), calc(100vh - var(--feet) - var(--top) - var(--hold-room)));
    --dragon-h: min(max(clamp(140px, 36vh, 320px), calc(var(--side) * 1.176)), calc(100vh - var(--dragon-feet) - var(--top) - 16px));
  }
  .battle-stage.has-hud {
    --top: calc(var(--hud-band) + 8px);
  }
  .battle-scene {
    position: absolute;
    inset: 0;
  }
  .battle-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 60%;
    transition: filter 0.4s ease;
  }
  .battle-stage[data-phase='proofreading'] .battle-backdrop {
    filter: brightness(0.7) saturate(0.85);
  }
  /* Ruling C6: the victory sheet unrolls over the dimmed battlefield. Only the ground dims: the
     combatants stay lit, so the reckoning's strikes and end poses read beside the sheet. */
  .battle-stage[data-phase='victory'] .battle-backdrop {
    filter: brightness(0.6) saturate(0.8);
  }
  .battle-scene :global(.combatant.left) {
    --h: var(--dragon-h);
    --feet: var(--dragon-feet);
    /* Against the screen's edge once it is wider than its column (its wing's transparent margin).
       Ruling B15, its face first: where the never-smaller floor makes it too wide for its column
       (1180x820, 1024x768) it slides off the left edge (its far wing and tail) until it tucks 16 % at
       most under the parchment, its snout (81 % of its box) clear. 16 %, not 15 %: at 1024x640 the
       floor tucks 15.5 % and the dragon stays on screen there. */
    --left-x: min(max(env(safe-area-inset-left), calc((var(--side) - var(--h)) / 2)), calc(var(--side) - 0.84 * var(--h)));
  }
  .battle-scene :global(.combatant.right) {
    --h: var(--foe-h);
    --right-x: max(8px, calc((var(--side) - var(--h) * 0.5713) / 2));
  }
  /* The exit sign sits in the bottom-left corner: the dragon stands above it, not behind it. */
  .battle-stage.has-exit {
    --dragon-feet: calc(84px + env(safe-area-inset-bottom));
  }
  .hit-burst {
    position: absolute;
    right: calc(var(--side) / 2 - 60px);
    bottom: calc(var(--feet) + var(--foe-h) / 2 - 60px);
    width: 120px;
    height: 120px;
    pointer-events: none;
  }
  /* The hold hangs above the opponent's head (UI4 playability #20): centred on the right side's
     middle, where the opponent stands, not in the far corner of a wide screen. */
  .hp-slot {
    --hp-slot-w: min(240px, calc(var(--side) - 24px));
    position: absolute;
    top: var(--top);
    right: max(12px, calc(var(--side) / 2 - var(--hp-slot-w) / 2));
    width: var(--hp-slot-w);
    z-index: 3;
  }
  .battle-parchment {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: var(--parchment-w);
    top: var(--top);
    bottom: calc(12px + env(safe-area-inset-bottom));
    z-index: 4;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-radius: 14px;
    background:
      linear-gradient(var(--battle-parchment-edge), var(--battle-parchment-edge)),
      var(--tex-parchment);
    box-shadow:
      0 0 0 2px rgba(201, 171, 116, 0.55),
      0 12px 40px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }
  /* UI4 playability #14: a short muster's parchment hugs its content, centred between its top and
     bottom lines (an absolute box with both insets, a content height and auto margins), and scrolls
     inside once it would pass them. Its height is its phase's, so that phase's flex basis must be
     its content (`flex: 1 1 auto`), never a 0 % that iPad Safari resolves to 0 (iPad report
     2026-09-28: the grimoire's parchment collapsed to a strip thinner than its title). */
  .battle-parchment.hug {
    height: fit-content;
    max-height: calc(100% - var(--top) - 12px - env(safe-area-inset-bottom));
    margin-block: auto;
  }
  .battle-stage :global(.scene-exit) {
    left: calc(12px + env(safe-area-inset-left));
    bottom: calc(12px + env(safe-area-inset-bottom));
  }
  .stage-hud {
    position: absolute;
    inset: 0 0 auto 0;
    z-index: 5;
    height: 0;
  }
  .battle-stage :global(:is(.stage-text, .scene-exit)) {
    transition: opacity 0.2s ease;
  }
  .battle-stage.has-overlay :global(:is(.stage-text, .scene-exit)) {
    opacity: 0;
  }

  /* Ruling C4: the keyboard is open. The stage follows the visual viewport; the scene is a band. */
  .battle-stage[data-layout='compact'] {
    inset: auto 0 auto 0;
    top: var(--vv-top, 0px);
    height: var(--vvh, 100dvh);
    /* The whole width under the band (lane P fix round 1): no night gutter beside the parchment. */
    --parchment-w: 100vw;
  }
  .battle-stage[data-layout='compact'] .battle-scene {
    inset: 0 0 auto 0;
    height: var(--band);
    overflow: hidden;
    border-bottom: 2px solid var(--bronze-light);
  }
  .battle-stage[data-layout='compact'] .battle-backdrop {
    object-position: 50% 45%;
  }
  /* Inset from the band's edges (UI4 playability #20: Léthé was clipped by the right edge). */
  .battle-stage[data-layout='compact'] .battle-scene :global(.combatant) {
    --h: calc(var(--band) - 16px);
    --feet: 6px;
  }
  .battle-stage[data-layout='compact'] .battle-scene :global(.combatant.left) {
    --left-x: 24px;
  }
  .battle-stage[data-layout='compact'] .battle-scene :global(.combatant.right) {
    --right-x: 24px;
  }
  .battle-stage[data-layout='compact'] {
    --hp-w: min(40vw, 320px);
  }
  /* With the HUD and « Le camp » in the band (I4) the hold bar narrows to leave them room. */
  .battle-stage[data-layout='compact'].band-tools {
    --hp-w: min(28vw, 300px);
  }
  .battle-stage[data-layout='compact'] .hp-slot {
    top: 50%;
    left: 50%;
    right: auto;
    transform: translate(-50%, -50%);
    width: var(--hp-w);
  }
  .band-hud {
    position: absolute;
    inset: 0;
    z-index: 5;
  }
  .band-hud > :global(.scene-exit) {
    position: absolute;
    top: 50%;
    left: 25%;
    transform: translate(-50%, -50%);
  }
  .band-hud :global(.hud-left .scene-exit) {
    position: static;
  }
  /* « Le camp » as its arrow alone in the band; the words stay its accessible name. */
  .band-hud :global(.scene-exit) {
    min-width: 48px;
    padding-inline: 12px;
  }
  .band-hud :global(.scene-exit span) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .battle-stage[data-layout='compact'] .hit-burst {
    display: none;
  }
  .battle-stage[data-layout='compact'] .battle-parchment {
    top: var(--band);
    bottom: 0;
    border-radius: 0;
  }

  /* Keep in sync with RotateScreen.svelte's media query (spec §4: "portrait and aspect < 1"). */
  @media (orientation: portrait) and (aspect-ratio < 1) {
    .battle-stage > :global(.scene-transition) {
      display: none;
    }
  }
</style>
