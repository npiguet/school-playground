<!-- web/src/components/LivingDragon.svelte -->
<script lang="ts">
  // The living dragon (spec 2026-10-02 living dragon, "Component"): one WebGL2 canvas drawing the stage's
  // sprite on its skinned mesh with its worn pieces riding along, slowly and slightly alive. It covers
  // the same square box as the still picture, the canvas overflowing it by the 3.5 % margin so a wing
  // tip may move out. It tells DragonFigure how it goes (onmotion): `pending` while loading (the still
  // picture shows, this waits hidden), `living` from its first frame, `still` on any failure (no
  // WebGL2, a shader, a load, a tint it cannot express, a lost context: plan Ruling R4), after which
  // DragonFigure unmounts it. A new stage or picture starts afresh, `pending` again, on a new canvas
  // (Ruling L2; a disposed canvas's context is lost for good). The loop draws at most 30 frames a second
  // and stops while the page is hidden or the canvas is off-screen. `amplitude`, `time` and
  // `showWeights` serve the lab.
  import { onMount, untrack } from 'svelte';
  import type { OverlayLayer } from '../lib/world/accessories';
  import { buildAtlas, loadImage, pieceDraws, placePieces } from '../lib/living/atlas';
  import { AMPLITUDE, frameDue, poseAt } from '../lib/living/pose';
  import { DragonRenderer } from '../lib/living/renderer';
  import { loadRig, type LivingStage, type Motion, type Rig } from '../lib/living/rigs';
  import { MARGIN } from '../lib/living/skin';

  let {
    stage,
    src,
    alt,
    filter,
    overlays,
    amplitude = AMPLITUDE,
    time = null,
    showWeights = false,
    onmotion,
  }: {
    stage: LivingStage;
    src: string;
    alt: string;
    filter: string;
    overlays: OverlayLayer[];
    amplitude?: number;
    time?: number | null;
    showWeights?: boolean;
    onmotion: (m: Motion) => void;
  } = $props();

  let host = $state<HTMLDivElement>();
  let motion = $state<Motion>('pending');
  let applied = $state({ filter: '', worn: '' });

  let canvas: HTMLCanvasElement | null = null;
  let renderer: DragonRenderer | null = null;
  let rig: Rig | null = null;
  let raf = 0;
  let last: number | null = null;
  let frames = 0;
  let visible = true;
  let onScreen = true;
  let piecesKey = '';
  let piecesToken = 0;
  const started = performance.now();

  function still(): void {
    if (motion === 'still') return;
    motion = 'still';
    pause();
    renderer?.dispose();
    renderer = null;
    onmotion('still');
  }

  function draw(now: number): void {
    if (!renderer || !rig || !canvas) return;
    renderer.draw(poseAt(time ?? (now - started) / 1000, rig.pivots, amplitude), showWeights);
    frames += 1;
    canvas.dataset.frames = String(frames);
    if (motion === 'pending') {
      motion = 'living';
      onmotion('living');
    }
  }

  function tick(now: number): void {
    raf = 0;
    if (!renderer) return;
    if (frameDue(now, last)) {
      last = now;
      draw(now);
    }
    schedule();
  }

  function schedule(): void {
    if (!raf && renderer && visible && onScreen) raf = requestAnimationFrame(tick);
  }

  function pause(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function resize(): void {
    if (!renderer || !host) return;
    const width = host.getBoundingClientRect().width;
    renderer.resize(Math.max(1, Math.round(width * (1 + 2 * MARGIN) * Math.min(2, window.devicePixelRatio || 1))));
    last = null; // a resized canvas is blank: draw at the next frame
  }

  async function applyPieces(list: OverlayLayer[]): Promise<void> {
    const key = list.map((o) => o.src).join(' ');
    if (key === piecesKey) return;
    const token = ++piecesToken;
    const placed = placePieces(list);
    const atlas = placed.length ? await buildAtlas(placed) : null;
    if (token !== piecesToken || !renderer || !rig) return;
    renderer.setPieces(atlas, pieceDraws(placed, rig.weights));
    piecesKey = key;
    applied.worn = placed.map((p) => p.item).join(' ');
    last = null;
  }

  function applyTint(css: string): void {
    if (!renderer || css === applied.filter) return;
    renderer.setTint(css);
    applied.filter = css;
    last = null;
  }

  /** One try at the living path for this stage and picture, on a fresh canvas; returns its teardown. */
  function start(el: HTMLDivElement, s: LivingStage, url: string): () => void {
    let disposed = false;
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    const edge = `${-MARGIN * 100}%`;
    const side = `${100 + 2 * MARGIN * 100}%`;
    Object.assign(cv.style, { position: 'absolute', display: 'block', left: edge, top: edge, width: side, height: side });
    const onLost = () => {
      if (!disposed) still();
    };
    cv.addEventListener('webglcontextlost', onLost);
    el.append(cv);
    canvas = cv;
    frames = 0;
    last = null;
    piecesKey = '';
    piecesToken += 1;
    applied.filter = '';
    applied.worn = '';
    motion = 'pending';
    onmotion('pending');
    (async () => {
      try {
        const [r, sprite] = await Promise.all([loadRig(s), loadImage(url)]);
        if (disposed) return;
        rig = r;
        renderer = new DragonRenderer(cv, sprite, r);
        applyTint(filter);
        await applyPieces(overlays);
        if (disposed) return;
        resize();
        schedule();
      } catch {
        if (!disposed) still();
      }
    })();
    return () => {
      disposed = true;
      pause();
      cv.removeEventListener('webglcontextlost', onLost);
      renderer?.dispose();
      renderer = null;
      rig = null;
      cv.remove();
      if (canvas === cv) canvas = null;
    };
  }

  onMount(() => {
    const el = host!;
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen) schedule();
      else pause();
    });
    io.observe(el);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) schedule();
      else pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  });

  // The living path, afresh for each stage and picture (Ruling L2: after a failure too).
  $effect(() => {
    const el = host;
    const s = stage;
    const url = src;
    if (!el) return;
    return untrack(() => start(el, s, url));
  });

  // A tint picked or a piece changed while the dragon is on screen: in place, no remount.
  $effect(() => {
    const css = filter;
    untrack(() => {
      try {
        applyTint(css);
      } catch {
        still();
      }
    });
  });
  $effect(() => {
    const list = overlays;
    untrack(() => {
      if (renderer) applyPieces(list).catch(still);
    });
  });
</script>

<div
  bind:this={host}
  class="dragon-living"
  class:dragon-base={motion === 'living'}
  class:pending={motion !== 'living'}
  role="img"
  aria-label={alt}
  data-src={src}
  data-filter={applied.filter}
  data-worn={applied.worn}
></div>

<style>
  .dragon-living {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 1 / 1;
    pointer-events: none;
  }
  /* Loading: the still picture holds the box; the canvas waits, hidden, over it. */
  .dragon-living.pending {
    position: absolute;
    inset: 0;
    visibility: hidden;
  }
</style>
