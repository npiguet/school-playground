<script lang="ts">
  // The victory's laurel wreath (spec §3 "chest/laurel animation", UI4 Ruling C6): two branches of
  // gold leaves growing in around the title, inline SVG (no emoji, no new art). Reduced motion:
  // the wreath is simply there.
  let { reduced = false, size = 136 }: { reduced?: boolean; size?: number } = $props();
  const LEAVES = 7;
  // Angles from just off the bottom of the circle (175°) up each side to 55° off the top: two
  // branches meeting below, wide open above, an emblem crowning the title (tuned in the walk).
  const leaves = Array.from({ length: LEAVES }, (_, i) => {
    const deg = 175 - (i * (175 - 55)) / (LEAVES - 1);
    const rad = (deg * Math.PI) / 180;
    return { i, x: 78 * Math.sin(rad), y: -78 * Math.cos(rad), deg };
  });
</script>

<svg class="wreath" class:still={reduced} viewBox="-100 -66 200 164" width={size} height={size * 0.82} aria-hidden="true" data-testid="victory-laurel">
  <defs>
    <linearGradient id="leaf-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f1dc9a" />
      <stop offset="1" stop-color="#c9a227" />
    </linearGradient>
  </defs>
  {#each [-1, 1] as side (side)}
    {#each leaves as l (l.i)}
      <g transform="translate({side * l.x} {l.y}) rotate({side * (l.deg - 90)})">
        <ellipse class="leaf" style="--i:{l.i}" rx="8" ry="17" fill="url(#leaf-gold)" />
      </g>
    {/each}
  {/each}
</svg>

<style>
  .wreath {
    display: block;
    margin: 0 auto 6px;
    overflow: visible;
  }
  .leaf {
    stroke: var(--bronze-dark);
    stroke-width: 1.4;
    transform-box: fill-box;
    transform-origin: center;
    animation: leaf-in 0.34s cubic-bezier(0.2, 0.9, 0.3, 1.3) calc(var(--i) * 70ms) both;
  }
  .still .leaf {
    animation: none;
  }
  @keyframes leaf-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
  }
</style>
