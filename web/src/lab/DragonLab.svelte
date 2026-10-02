<script lang="ts">
  // Every stage with a rig, living side by side (the dragon-rig skill, "The lab"): amplitude, tint,
  // the worn pieces, the weights view, pause and a time slider. For the rig review and the human look.
  import LivingDragon from '../components/LivingDragon.svelte';
  import { ART } from '../lib/world/art';
  import { accessoryLayers } from '../lib/world/accessories';
  import { TINT_FILTERS, TINT_NAMES } from '../lib/world/dragon';
  import { AMPLITUDE } from '../lib/living/pose';
  import { LIVING_STAGES, livingStage, type Motion } from '../lib/living/rigs';
  import type { Tint } from '../lib/world/types';

  const WORN = ['lethe-queue', 'sirenes-dos', 'hydre-cou', 'echo-tete'];
  const stages = LIVING_STAGES.filter((s) => livingStage(s) !== null);
  const tints = Object.keys(TINT_FILTERS) as Tint[];
  const MOTION_WORDS: Record<Motion, string> = { pending: 'chargement', living: 'vivant', still: 'image fixe' };

  let amplitude = $state(AMPLITUDE);
  let tint = $state<Tint>('bronze');
  let pieces = $state(false);
  let weights = $state(false);
  let paused = $state(false);
  let at = $state(0);
  let motions = $state<Partial<Record<string, Motion>>>({});
</script>

<main>
  <h1>Le dragon vivant</h1>
  <div class="controls">
    <label>Amplitude <input type="range" min="0" max="3" step="0.05" bind:value={amplitude} /> {amplitude.toFixed(2)}x</label>
    <label>Teinte
      <select bind:value={tint}>
        {#each tints as t (t)}<option value={t}>{TINT_NAMES[t]}</option>{/each}
      </select>
    </label>
    <label><input type="checkbox" bind:checked={pieces} /> Parure</label>
    <label><input type="checkbox" bind:checked={weights} /> Poids</label>
    <label><input type="checkbox" bind:checked={paused} /> Pause</label>
    <label>Temps <input type="range" min="0" max="30" step="0.02" bind:value={at} disabled={!paused} /> {at.toFixed(2)} s</label>
  </div>
  <div class="grid">
    {#each stages as s (s)}
      <figure>
        <figcaption data-stage={s}>{s}&#8239;: {MOTION_WORDS[motions[s] ?? 'pending']}</figcaption>
        <div class="box">
          <LivingDragon
            stage={s}
            src={ART.dragon[s]}
            alt={s}
            filter={TINT_FILTERS[tint]}
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
</style>
