<script lang="ts">
  // Ambient particle layer (scenes UI spec §2.1). SceneStage never mounts it under reduced motion.
  import { FX_COUNTS, moteAlpha, spawnMote, stepMotes, type Mote } from '../../lib/scene/fx';
  import type { FxPreset } from '../../lib/scene/types';

  let { preset }: { preset: FxPreset } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    const el = canvas;
    const kind = preset;
    if (!el || kind === 'none') return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    let w = 1;
    let h = 1;
    let motes: Mote[] = [];

    // Backing store scaled by devicePixelRatio (capped at 2) so particles stay crisp on Retina
    // iPad; ctx.setTransform keeps every draw call in CSS-pixel (logical) coordinates.
    const resize = () => {
      const r = el.getBoundingClientRect();
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
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });
</script>

<canvas bind:this={canvas} class="fx-canvas" data-testid="fx-canvas" aria-hidden="true"></canvas>

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
