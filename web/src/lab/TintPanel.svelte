<script lang="ts">
  // The lab's « Teintes » panel: one stage and one tint on a living dragon, with the OKLCH sliders
  // (the game's tint method since the user's choice of 2026-10-02, at full strength) starting at the
  // tint's TINT_SPECS entry, and a copyable line. Each tint keeps its settings while another is looked
  // at.
  // Amended 2026-10-03, baked tints (the user: "Keep the lab, and keep its sliders. I can use it if I
  // want to add or modify the tints, to get a preview"): the sliders tint live on the shader, over the
  // bronze sprite, as a preview only; the game shows the pictures baked by tools/art/bake_tints.py,
  // shown here beside the preview (« Le jeu »), and a changed tint needs a re-bake (the panel says so).
  import LivingDragon from '../components/LivingDragon.svelte';
  import { ART, dragonArt } from '../lib/world/art';
  import { TINT_NAMES, TINT_SPECS } from '../lib/world/dragon';
  import type { LivingStage, Motion } from '../lib/living/rigs';
  import { tintText, type OklchSpec } from '../lib/living/tint';
  import type { Tint } from '../lib/world/types';

  let { stages }: { stages: readonly LivingStage[] } = $props();

  const tints = Object.keys(TINT_SPECS) as Tint[];
  const MOTION_WORDS: Record<Motion, string> = { pending: 'chargement', living: 'vivant', still: 'image fixe' };
  const NONE: OklchSpec = { shift: 0, chroma: 1, lightness: 1 };
  const preset = (t: Tint): OklchSpec => ({ ...(TINT_SPECS[t] ?? NONE) });

  let stage = $state<LivingStage>('adult');
  let tint = $state<Tint>('ecume');
  let specs = $state(Object.fromEntries(tints.map((t) => [t, preset(t)])) as Record<Tint, OklchSpec>);
  let motion = $state<Motion>('pending');
  let copied = $state<string | null>(null);

  const spec = $derived(specs[tint]);
  const line = $derived(tintText(tint, spec));
  const lines = $derived(tints.map((t) => tintText(t, specs[t])));

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
  <p class="baked" data-testid="tints-baked-note">
    Ces curseurs ne font qu'un aperçu, teint en direct&#8239;: le jeu montre des images cuites d'avance, une par stade et
    par teinte. Pour changer une teinte du jeu, reporter ses réglages dans <code>web/src/lib/world/tintSpecs.json</code>,
    puis recuire les images&#8239;: <code>tools/art/run_docker.sh bake</code>
  </p>
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
    <span class="game">Le jeu&#8239;: <code>{tintText(tint, TINT_SPECS[tint])}</code></span>
  </div>
  <figure data-mode="oklch">
    <figcaption>OKLCH&#8239;: {MOTION_WORDS[motion]}</figcaption>
    <div class="box">
      <LivingDragon rig={stage} src={ART.dragon[stage]} alt={`${stage} oklch`} {tint} overlays={[]} tintSpec={spec} onmotion={(m) => (motion = m)} />
    </div>
    <div class="sliders">
      <label>Décalage de teinte <input type="range" min="-180" max="180" step="1" bind:value={specs[tint].shift} /> <output>{spec.shift}°</output></label>
      <label>Chroma (C) <input type="range" min="0" max="2" step="0.01" bind:value={specs[tint].chroma} /> <output>{spec.chroma.toFixed(2)}</output></label>
      <label>Clarté (L) <input type="range" min="0.5" max="1.5" step="0.01" bind:value={specs[tint].lightness} /> <output>{spec.lightness.toFixed(2)}</output></label>
    </div>
    <code class="line" data-line="oklch">{line}</code>
    <div class="buttons">
      <button type="button" onclick={() => copy(line, 'one')}>{copied === 'one' ? 'Copié' : 'Copier'}</button>
      <button type="button" onclick={() => (specs[tint] = preset(tint))}>Réinitialiser</button>
    </div>
  </figure>
  <figure data-mode="baked">
    <figcaption>Le jeu, image cuite</figcaption>
    <div class="box">
      <img class="baked-pic" src={dragonArt(stage, tint)} alt={`${stage} ${tint}`} draggable="false" />
    </div>
  </figure>
  <label class="all">Toutes les teintes
    <textarea readonly rows={tints.length} value={lines.join('\n')} onclick={(e) => e.currentTarget.select()}></textarea>
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
  .baked {
    max-width: 720px;
    margin: 0 0 10px;
    padding: 8px 10px;
    background: #fff6dc;
    border-left: 4px solid #b8863b;
  }
  .baked-pic {
    display: block;
    width: 100%;
    height: auto;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 22px;
    margin-bottom: 12px;
  }
  figure {
    max-width: 520px;
    margin: 0 0 12px;
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
    max-width: 520px;
  }
  textarea {
    font: 12px/1.4 ui-monospace, monospace;
    width: 100%;
    box-sizing: border-box;
  }
</style>
