<!-- web/src/components/LivingDragon.svelte -->
<script lang="ts">
  // The living dragon (spec 2026-10-02 living dragon, "Component") and, since spec 2026-10-03 living
  // battle (plan Rulings B2, B5), any living rig: a dragon stage or a battle foe, the foe's 585 px
  // portrait padded into the frame and its box kept at the portrait's aspect; a foe is never tinted
  // (`tint` null). One WebGL2 canvas drawing the rig's sprite on its skinned mesh with its worn pieces
  // riding along, slowly and slightly alive. It covers the same box as the still picture (square for a
  // dragon, the portrait's aspect for a foe), the canvas overflowing it by the 3.5 % margin of the frame
  // (and, for a foe, by the frame's padding on both sides) so a wing tip may move out. It tells
  // DragonFigure how it goes (onmotion): `pending` while loading (the still picture shows, this waits
  // hidden), `living` from its first frame, `still` on any failure (no WebGL2, a shader, a load, a lost
  // context: plan Ruling R4), after which DragonFigure unmounts it. A new rig or picture starts afresh,
  // `pending` again, on a new canvas (Ruling L2; a disposed canvas's context is lost for good). The loop
  // draws at most 30 frames a second and stops while the page is hidden or the canvas is off-screen.
  // `amplitude`, `time`, `showWeights` and `tintSpec` (OKLCH settings in place of the tint's TINT_SPECS
  // entry) serve the lab.
  import { onMount, untrack } from 'svelte';
  import type { OverlayLayer } from '../lib/world/accessories';
  import { buildAtlas, loadImage, padToFrame, pieceDraws, placePieces } from '../lib/living/atlas';
  import { AMPLITUDE, frameDue, poseFor } from '../lib/living/pose';
  import { DragonRenderer } from '../lib/living/renderer';
  import type { OklchSpec } from '../lib/living/tint';
  import { TINT_SPECS } from '../lib/world/dragon';
  import type { Tint } from '../lib/world/types';
  import { FOE_WIDTH, isFoeRig, loadRig, type LivingRig, type Motion, type Rig } from '../lib/living/rigs';
  import { FRAME, MARGIN, frameOffset } from '../lib/living/skin';

  let {
    rig: rigId,
    src,
    alt,
    tint,
    overlays,
    amplitude = AMPLITUDE,
    time = null,
    showWeights = false,
    tintSpec = undefined,
    onmotion,
  }: {
    rig: LivingRig;
    src: string;
    alt: string;
    tint: Tint | null;
    overlays: OverlayLayer[];
    amplitude?: number;
    time?: number | null;
    showWeights?: boolean;
    tintSpec?: OklchSpec | null;
    onmotion: (m: Motion) => void;
  } = $props();

  let host = $state<HTMLDivElement>();
  let motion = $state<Motion>('pending');
  let applied = $state({ tint: '', worn: '' });

  let canvas: HTMLCanvasElement | null = null;
  let spriteWidth = FRAME;
  let renderer: DragonRenderer | null = null;
  let rig: Rig | null = null;
  let raf = 0;
  let last: number | null = null;
  let frames = 0;
  let visible = !document.hidden;
  let onScreen = true;
  let piecesKey = '';
  let tintKey = '';
  let piecesToken = 0;
  let tryId = 0; // the current try at the living path; any teardown or new try moves it on
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
    renderer.draw(poseFor(rig.motion, time ?? (now - started) / 1000, rig.pivots, amplitude), showWeights);
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
    // The canvas spans the whole frame plus its margin; the host spans the sprite's own width.
    const scale = (FRAME * (1 + 2 * MARGIN)) / spriteWidth;
    renderer.resize(Math.max(1, Math.round(width * scale * Math.min(2, window.devicePixelRatio || 1))));
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

  function applyTint(name: Tint | null, override: OklchSpec | null | undefined): void {
    const spec = override === undefined ? (name ? TINT_SPECS[name] : null) : override;
    // The exact numbers, as the still tint's cache (stillTint.ts): a lab slider's 0.005 apart are two tints.
    const key = spec ? `${name} ${spec.shift} ${spec.chroma} ${spec.lightness}` : `${name ?? 'untinted'} none`;
    if (!renderer || key === tintKey) return;
    renderer.setTint(spec);
    tintKey = key;
    applied.tint = name ?? '';
    last = null;
  }

  /** One try at the living path for this rig and picture, on a fresh canvas; returns its teardown. */
  function start(el: HTMLDivElement, s: LivingRig, url: string): () => void {
    let disposed = false;
    const id = ++tryId;
    spriteWidth = isFoeRig(s) ? FOE_WIDTH : FRAME;
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    // The host spans the sprite (the frame's middle `spriteWidth` px), the canvas the whole frame and
    // its margin: for a dragon left -3.5 % and 107 % wide, as before the living battle.
    const m = MARGIN * FRAME;
    Object.assign(cv.style, {
      position: 'absolute',
      display: 'block',
      left: `${(-(frameOffset(spriteWidth) + m) / spriteWidth) * 100}%`,
      top: `${-MARGIN * 100}%`,
      width: `${((FRAME + 2 * m) / spriteWidth) * 100}%`,
      height: `${(1 + 2 * MARGIN) * 100}%`,
    });
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
    tintKey = '';
    applied.tint = '';
    applied.worn = '';
    motion = 'pending';
    onmotion('pending');
    (async () => {
      try {
        const [r, img] = await Promise.all([loadRig(s), loadImage(url)]);
        if (disposed) return;
        if (r.width !== spriteWidth) throw new Error(`rig ${s} is ${r.width} px wide, its box ${spriteWidth}`);
        rig = r;
        renderer = new DragonRenderer(cv, padToFrame(img, r.width), r);
        applyTint(tint, tintSpec);
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
      if (tryId === id) tryId += 1;
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

  // The rig and the picture by value: a prop read straight from the parent's expression (the scene
  // layer's `layer.src`) changes with every new camp snapshot, the same string or not (a tint picked,
  // a piece put on); only a new value may start a new try (Task 8: the canvas was remounted).
  const rigNow = $derived(rigId);
  const srcNow = $derived(src);
  // The host's aspect: the portrait's width over the frame's height (a foe), or the square frame.
  const boxWidth = $derived(isFoeRig(rigId) ? FOE_WIDTH : FRAME);

  // The living path, afresh for each rig and picture (Ruling L2: after a failure too).
  $effect(() => {
    const el = host;
    const s = rigNow;
    const url = srcNow;
    if (!el) return;
    return untrack(() => start(el, s, url));
  });

  // A tint picked or a piece changed while the dragon is on screen: in place, no remount.
  $effect(() => {
    const name = tint;
    const spec = tintSpec ? { ...tintSpec } : tintSpec;
    untrack(() => {
      try {
        applyTint(name, spec);
      } catch {
        still();
      }
    });
  });
  $effect(() => {
    const list = overlays;
    untrack(() => {
      if (!renderer) return;
      // A rejection from a try since torn down (a new rig, or unmounted) must not touch the current one.
      const id = tryId;
      applyPieces(list).catch(() => {
        if (id === tryId) still();
      });
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
  data-tint={applied.tint || undefined}
  style:aspect-ratio="{boxWidth} / {FRAME}"
  data-worn={applied.worn}
></div>

<style>
  .dragon-living {
    position: relative;
    display: block;
    width: 100%;
    pointer-events: none;
  }
  /* Loading: the still picture holds the box; the canvas waits, hidden, over it. */
  .dragon-living.pending {
    position: absolute;
    inset: 0;
    visibility: hidden;
  }
</style>
