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
  import { TINT_FILTERS } from '../../lib/world/dragon';
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
    children,
  }: {
    battle: BattleDef | null;
    phase: BattlePhase;
    mode?: BattleMode;
    profile: Profile;
    camp: CampResponse | null;
    dragon: DragonOut | null;
    hud?: boolean;
    exit?: boolean;
    children: Snippet<[BattleLayout]>;
  } = $props();

  resetBattleStage();
  let reduced = $state(reducedMotion());
  $effect(() => watchReducedMotion((r) => (reduced = r)));
  onMount(() => watchViewport());

  const layout = $derived<BattleLayout>(viewport.height > 0 ? battleLayout(viewport.height, viewport.inner) : 'full');
  const band = $derived(bandHeight(viewport.height || 820));
  const covered = $derived(overlayState.open > 0);
  // Ruling C12: during proofreading nothing moves behind the text.
  const idle = $derived(phase !== 'proofreading');
  const dragonStage = $derived(dragon?.stage ?? 'egg');

  $effect(() => {
    if (battle) emitBattle({ kind: 'start', opponent: battle.opponent.id, mode });
  });
  $effect(() => emitBattle({ kind: 'phase', phase }));

  const onHero = () => go(heroPanelHref(profile.id), 'panel');
</script>

<main
  class="battle-stage"
  class:has-overlay={covered}
  class:has-hud={hud && layout === 'full'}
  class:has-exit={exit && layout === 'full'}
  data-testid="scene-battle"
  data-phase={phase}
  data-layout={layout}
  data-opponent={battle?.opponent.id ?? ''}
  data-backdrop={battle?.backdrop.id ?? ''}
  data-reduced-motion={reduced ? 'true' : 'false'}
  inert={covered}
  style:--band="{band}px"
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
              filter={TINT_FILTERS[dragon.tint]}
              reaction={battleStage.dragon.reaction}
              nonce={battleStage.dragon.nonce}
              testId="battle-dragon"
              {idle}
              {reduced}
            />
          {/if}
          <Combatant
            src={battle.opponent.art}
            alt={battle.opponent.alt}
            side="right"
            mirror={FACES[battle.opponent.id] !== 'left'}
            reaction={battleStage.opponent.reaction}
            nonce={battleStage.opponent.nonce}
            hits={battleStage.hits}
            testId="battle-opponent"
            {idle}
            {reduced}
          />
          <!-- Particles fires on mount too: it mounts with the first strike, never before. -->
          {#if battleStage.hits > 0}
            <div class="hit-burst" aria-hidden="true"><Particles trigger={battleStage.hits} kind="burst" /></div>
          {/if}
        {/key}
        <div class="hp-slot"><HpBar name={battle.opponent.name} label={EMPRISE[battle.opponent.id]} hp={battleStage.hp} /></div>
      {/if}
    </div>
    <section class="battle-parchment" data-testid="battle-parchment" aria-label={battle?.opponent.name ?? ''}>
      {@render children(layout)}
    </section>
    {#if exit && layout === 'full'}<SceneExit profileId={profile.id} />{/if}
  </SceneTransition>
  <div class="stage-hud" data-testid="stage-hud">
    {#if hud && layout === 'full'}<Hud {profile} {camp} {onHero} />{/if}
  </div>
  <RotateScreen background={battle?.backdrop.src ?? null} />
</main>

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
  .battle-scene :global(.combatant.left) {
    --h: clamp(140px, 36vh, 320px);
    --left-x: max(8px, calc(var(--side) / 2 - 0.35 * var(--h)));
    --feet: calc(4vh + env(safe-area-inset-bottom));
  }
  .battle-scene :global(.combatant.right) {
    --h: clamp(180px, 50vh, 440px);
    --right-x: max(8px, calc(var(--side) / 2 - 0.3 * var(--h)));
    --feet: calc(4vh + env(safe-area-inset-bottom));
  }
  /* The exit sign sits in the bottom-left corner: the dragon stands above it, not behind it. */
  .battle-stage.has-exit .battle-scene :global(.combatant.left) {
    --feet: calc(84px + env(safe-area-inset-bottom));
  }
  .hit-burst {
    position: absolute;
    right: calc(var(--side) / 2 - 60px);
    bottom: 30vh;
    width: 120px;
    height: 120px;
    pointer-events: none;
  }
  .hp-slot {
    position: absolute;
    top: var(--top);
    right: 12px;
    width: min(240px, calc(var(--side) - 24px));
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
  .battle-stage[data-layout='compact'] .battle-scene :global(.combatant) {
    --h: calc(var(--band) - 8px);
    --feet: 4px;
  }
  .battle-stage[data-layout='compact'] .battle-scene :global(.combatant.left) {
    --left-x: 12px;
  }
  .battle-stage[data-layout='compact'] .battle-scene :global(.combatant.right) {
    --right-x: 12px;
  }
  .battle-stage[data-layout='compact'] .hp-slot {
    top: 50%;
    left: 50%;
    right: auto;
    transform: translate(-50%, -50%);
    width: min(40vw, 320px);
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
