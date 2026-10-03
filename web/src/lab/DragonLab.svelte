<script lang="ts">
  // Every stage with a rig, living side by side (the dragon-rig skill, "The lab"): amplitude, tint,
  // the worn pieces, the weights view, pause and a time slider. For the rig review and the human look.
  // Above them, the Teintes panel tunes a tint's OKLCH settings (TintPanel.svelte).
  // Below them, every battle foe with a rig, living side by side, mirrored as in the battle (« Comme au
  // combat »): spec 2026-10-03 living battle, plan Ruling B10. Every rig of stages.ts FOE_RIGS is
  // listed, baked or not (the plan's Task 3 named only the baked ones): a foe whose rig is not baked
  // yet shows its still portrait and says so, never a hole in the list, and lights up once
  // tools/art/rig.py bakes it (stages.ts livingFoe).
  // The stage controls drive the foes too (amplitude, weights, pause, time; a foe is never tinted
  // nor dressed). The controls carry ids for the shot script (plan Task 3, lab_foes.py).
  import LivingDragon from '../components/LivingDragon.svelte';
  import TintPanel from './TintPanel.svelte';
  import { ART } from '../lib/world/art';
  import { accessoryLayers } from '../lib/world/accessories';
  import { TINT_NAMES, TINT_SPECS } from '../lib/world/dragon';
  import { AMPLITUDE } from '../lib/living/pose';
  import { LIVING_STAGES, livingStage, type Motion } from '../lib/living/rigs';
  import { FOE_RIGS, livingFoe, type FoeRig } from '../lib/living/stages';
  import { FOE_SPRITES } from '../lib/living/foes';
  import { FACES } from '../lib/battle/battle';
  import type { Tint } from '../lib/world/types';

  const WORN = ['lethe-queue', 'sirenes-dos', 'hydre-cou', 'echo-tete'];
  const stages = LIVING_STAGES.filter((s) => livingStage(s) !== null);
  const tints = Object.keys(TINT_SPECS) as Tint[];
  const MOTION_WORDS: Record<Motion, string> = { pending: 'chargement', living: 'vivant', still: 'image fixe' };

  let amplitude = $state(AMPLITUDE);
  let tint = $state<Tint>('bronze');
  let pieces = $state(false);
  let weights = $state(false);
  let paused = $state(false);
  let at = $state(0);
  let motions = $state<Partial<Record<string, Motion>>>({});

  // Every foe, baked or not: a missing rig is a still portrait, never a hole in the list.
  const foes = FOE_RIGS.map((r) => ({ rig: r, baked: livingFoe(r) !== null }));
  // The battle mirrors an opponent that does not look left in its file (battle.ts FACES); Éris routed as Éris.
  const mirrored = (r: FoeRig) => FACES[r === 'eris_flustered' ? 'eris' : r] !== 'left';
  let asInBattle = $state(true);
</script>

<main>
  <h1>Le dragon vivant</h1>
  <TintPanel {stages} />
  <h2>Les stades</h2>
  <div class="controls">
    <label>Amplitude <input id="amplitude" type="range" min="0" max="3" step="0.05" bind:value={amplitude} /> {amplitude.toFixed(2)}x</label>
    <label>Teinte
      <select id="tint" bind:value={tint}>
        {#each tints as t (t)}<option value={t}>{TINT_NAMES[t]}</option>{/each}
      </select>
    </label>
    <label><input id="pieces" type="checkbox" bind:checked={pieces} /> Parure</label>
    <label><input id="weights" type="checkbox" bind:checked={weights} /> Poids</label>
    <label><input id="pause" type="checkbox" bind:checked={paused} /> Pause</label>
    <label>Temps <input id="time" type="range" min="0" max="30" step="0.02" bind:value={at} disabled={!paused} /> {at.toFixed(2)} s</label>
  </div>
  <div class="grid">
    {#each stages as s (s)}
      <figure>
        <figcaption data-stage={s}>{s}&#8239;: {MOTION_WORDS[motions[s] ?? 'pending']}</figcaption>
        <div class="box">
          <LivingDragon
            rig={s}
            src={ART.dragon[s]}
            alt={s}
            {tint}
            overlays={pieces ? accessoryLayers(WORN, s) : []}
            {amplitude}
            time={paused ? at : null}
            showWeights={weights}
            onmotion={(m) => (motions[s] = m)}
          />
        </div>
      </figure>
    {/each}
  </div>
  <h2>Les adversaires</h2>
  <div class="controls">
    <label><input id="as-battle" type="checkbox" bind:checked={asInBattle} /> Comme au combat</label>
  </div>
  <div class="grid foes">
    {#each foes as { rig: r, baked } (r)}
      <figure>
        <figcaption data-rig={r} data-baked={baked}>
          {r}&#8239;: {baked ? MOTION_WORDS[motions[r] ?? 'pending'] : 'image fixe, pas encore de rig'}
        </figcaption>
        <div class="portrait" class:mirror={asInBattle && mirrored(r)}>
          {#if !baked || motions[r] !== 'living'}
            <img class="still" src={FOE_SPRITES[r]} alt={r} draggable="false" />
          {/if}
          {#if baked}
            <LivingDragon
              rig={r}
              src={FOE_SPRITES[r]}
              alt={r}
              tint={null}
              overlays={[]}
              {amplitude}
              time={paused ? at : null}
              showWeights={weights}
              onmotion={(m) => (motions[r] = m)}
            />
          {/if}
        </div>
      </figure>
    {/each}
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #efe4cc;
    color: #2b2118;
    font: 15px/1.4 system-ui, sans-serif;
  }
  main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 16px;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 22px;
    margin-bottom: 14px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 14px;
  }
  figure {
    margin: 0;
    background: #f8f1e1;
    border: 1px solid #d6c6a4;
    border-radius: 10px;
    padding: 10px;
  }
  .box {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
  }
  .grid.foes {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  /* The foe's box at its portrait's aspect (585 / 1024, stages.ts FOE_ASPECT): the still picture and
     the living canvas take the same place; the canvas overflows it sideways, as in the battle. */
  .portrait {
    position: relative;
    width: 70%;
    margin: 0 auto;
    aspect-ratio: 585 / 1024;
  }
  .portrait.mirror {
    transform: scaleX(-1);
  }
  .still {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
