<script lang="ts">
  // Ambient particle layer (scenes UI spec §2.1). SceneStage never mounts it under reduced motion.
  // Final review M4: drawn at most 30 times a second, and not at all while nobody can see it (an
  // overlay covers the scene, or the stage is hidden behind the portrait rotate screen).
  import { FX_COUNTS, moteAlpha, spawnMote, stepMotes, type Mote } from '../../lib/scene/fx';
  import { overlayState } from '../../lib/scene/overlayState.svelte';
  import type { FxPreset } from '../../lib/scene/types';

  let { preset }: { preset: FxPreset } = $props();

  const FRAME_MS = 1000 / 30;

  let canvas: HTMLCanvasElement | undefined = $state();
  // The canvas has no size while the stage content is display:none (portrait).
  let hidden = $state(false);
  const paused = $derived(hidden || overlayState.open > 0);
  // Set by the drawing effect below; restarts the loop when `paused` turns false.
  let resume: (() => void) | null = null;

  $effect(() => {
    if (!paused) resume?.();
  });

  $effect(() => {
    const el = canvas;
    const kind = preset;
    if (!el || kind === 'none') return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    // How many times the loop was (re)built - tests check a rotation doesn't rebuild it.
    el.dataset.starts = String(Number(el.dataset.starts ?? 0) + 1);

    let w = 1;
    let h = 1;
    let motes: Mote[] = [];

    // Backing store scaled by devicePixelRatio (capped at 2) so particles stay crisp on Retina
    // iPad; ctx.setTransform keeps every draw call in CSS-pixel (logical) coordinates.
    // `isHidden` is local and only mirrored into `hidden`: reading the $state inside this effect
    // would make every portrait <-> landscape switch tear the particle loop down and rebuild it.
    const resize = () => {
      const r = el.getBoundingClientRect();
      const isHidden = r.width < 2 || r.height < 2;
      hidden = isHidden;
      if (isHidden) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      el.width = Math.max(1, Math.round(w * dpr));
      el.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    motes = Array.from({ length: FX_COUNTS[kind] }, () => spawnMote(kind, w, h, Math.random, true));
    const ro = new ResizeObserver(() => {
      resize();
      // After a resize (e.g. rotate, or the stage's art box changing size) any mote now outside
      // the new bounds is respawned inside them instead of drifting off a canvas it can't re-enter.
      motes = motes.map((m) => (m.x > w || m.y > h ? spawnMote(kind, w, h, Math.random, true) : m));
    });
    ro.observe(el);
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      raf = 0;
      if (paused) return; // resume() restarts the loop
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS - 1) return;
      const dt = Math.min(64, now - last);
      last = now;
      motes = stepMotes(motes, kind, w, h, dt, Math.random);
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        ctx.globalAlpha = moteAlpha(m);
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    resume = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    resume();

    return () => {
      resume = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });
</script>

<canvas
  bind:this={canvas}
  class="fx-canvas"
  data-testid="fx-canvas"
  data-paused={paused ? 'true' : 'false'}
  aria-hidden="true"
></canvas>

<style>
  .fx-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
  }
</style>
