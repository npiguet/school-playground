<script lang="ts">
  // The lab's « Teintes » panel (user, 2026-10-02: "can we try working in the HSV color space, and maybe
  // try rotating the H channel?"): one stage and one tint, the same living dragon three times, tinted by
  // the game's CSS matrices, by HSV and by OKLCH, each with its own sliders and a copyable line. Each
  // tint keeps its settings while another is looked at. HSV and OKLCH start at the hue the CSS tint
  // gives the bronze (presetSpec), with the tint's own saturate and brightness.
  import LivingDragon from '../components/LivingDragon.svelte';
  import { ART } from '../lib/world/art';
  import { TINT_FILTERS, TINT_NAMES } from '../lib/world/dragon';
  import type { LivingStage, Motion } from '../lib/living/rigs';
  import { presetSpec, tintText, type TintMode, type TintSpec } from '../lib/living/tint';
  import type { Tint } from '../lib/world/types';

  let { stages }: { stages: readonly LivingStage[] } = $props();

  const MODES: { mode: TintMode; title: string; sat: string; val: string }[] = [
    { mode: 'css', title: 'Matrices CSS (le jeu)', sat: 'Saturation', val: 'Luminosité' },
    { mode: 'hsv', title: 'HSV', sat: 'Saturation (S)', val: 'Valeur (V)' },
    { mode: 'oklch', title: 'OKLCH', sat: 'Chroma (C)', val: 'Clarté (L)' },
  ];
  const tints = Object.keys(TINT_FILTERS) as Tint[];
  const MOTION_WORDS: Record<Motion, string> = { pending: 'chargement', living: 'vivant', still: 'image fixe' };

  const presets = (t: Tint) => Object.fromEntries(MODES.map(({ mode }) => [mode, presetSpec(TINT_FILTERS[t], mode)])) as Record<TintMode, TintSpec>;

  let stage = $state<LivingStage>('adult');
  let tint = $state<Tint>('ecume');
  let specs = $state(Object.fromEntries(tints.map((t) => [t, presets(t)])) as Record<Tint, Record<TintMode, TintSpec>>);
  let motions = $state<Partial<Record<TintMode, Motion>>>({});
  let copied = $state<string | null>(null);

  const lines = $derived(MODES.map(({ mode }) => tintText(tint, specs[tint][mode])));

  function reset(mode: TintMode): void {
    specs[tint][mode] = presetSpec(TINT_FILTERS[tint], mode);
  }

  async function copy(text: string, what: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      copied = what;
    } catch {
      copied = null; // no clipboard here (plain http): the text box below selects on a click
    }
  }
</script>

<section class="tints">
  <h2>Teintes</h2>
  <div class="controls">
    <label>Stade
      <select bind:value={stage}>
        {#each stages as s (s)}<option value={s}>{s}</option>{/each}
      </select>
    </label>
    <label>Teinte
      <select bind:value={tint}>
        {#each tints as t (t)}<option value={t}>{TINT_NAMES[t]}{t === 'bronze' ? ' (aucune)' : ''}</option>{/each}
      </select>
    </label>
    <span class="css">CSS du jeu&#8239;: <code>{TINT_FILTERS[tint]}</code></span>
  </div>
  <div class="methods">
    {#each MODES as m, i (m.mode)}
      {@const spec = specs[tint][m.mode]}
      <figure data-mode={m.mode}>
        <figcaption>{m.title}&#8239;: {MOTION_WORDS[motions[m.mode] ?? 'pending']}</figcaption>
        <div class="box">
            <LivingDragon
              {stage}
              src={ART.dragon[stage]}
              alt={`${stage} ${m.mode}`}
              filter="none"
              overlays={[]}
              tintSpec={spec}
              onmotion={(mo) => (motions[m.mode] = mo)}
            />
        </div>
        <div class="sliders">
          <label>Décalage de teinte <input type="range" min="-180" max="180" step="1" bind:value={specs[tint][m.mode].shift} /> <output>{spec.shift}°</output></label>
          <label>{m.sat} <input type="range" min="0" max="2" step="0.01" bind:value={specs[tint][m.mode].sat} /> <output>{spec.sat.toFixed(2)}</output></label>
          <label>{m.val} <input type="range" min="0.5" max="1.5" step="0.01" bind:value={specs[tint][m.mode].val} /> <output>{spec.val.toFixed(2)}</output></label>
          <label>Force <input type="range" min="0" max="1" step="0.01" bind:value={specs[tint][m.mode].strength} /> <output>{spec.strength.toFixed(2)}</output></label>
        </div>
        <code class="line" data-line={m.mode}>{lines[i]}</code>
        <div class="buttons">
          <button type="button" onclick={() => copy(lines[i], m.mode)}>{copied === m.mode ? 'Copié' : 'Copier'}</button>
          <button type="button" onclick={() => reset(m.mode)}>Réinitialiser</button>
        </div>
      </figure>
    {/each}
  </div>
  <label class="all">Les trois lignes
    <textarea readonly rows="3" value={lines.join('\n')} onclick={(e) => e.currentTarget.select()}></textarea>
  </label>
  <button type="button" onclick={() => copy(lines.join('\n'), 'all')}>{copied === 'all' ? 'Copié' : 'Tout copier'}</button>
</section>

<style>
  .tints {
    margin-bottom: 28px;
  }
  h2 {
    margin: 0 0 8px;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 22px;
    margin-bottom: 12px;
  }
  .methods {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 14px;
    margin-bottom: 12px;
  }
  figure {
    margin: 0;
    background: #f8f1e1;
    border: 1px solid #d6c6a4;
    border-radius: 10px;
    padding: 10px;
  }
  figcaption {
    font-weight: 600;
  }
  .box {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
  }
  .sliders {
    display: grid;
    gap: 4px;
    margin: 8px 0;
  }
  .sliders label {
    display: grid;
    grid-template-columns: 9.5em 1fr 3.5em;
    align-items: center;
    gap: 6px;
  }
  output {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .line {
    display: block;
    font-size: 12px;
    overflow-wrap: anywhere;
    margin-bottom: 6px;
  }
  .buttons {
    display: flex;
    gap: 8px;
  }
  .all {
    display: grid;
    gap: 4px;
    margin-bottom: 6px;
  }
  textarea {
    font: 12px/1.4 ui-monospace, monospace;
    width: 100%;
    box-sizing: border-box;
  }
</style>
