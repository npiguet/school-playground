<script lang="ts">
  // The victory's laurel wreath (spec §3 "chest/laurel animation", UI4 Ruling C6): two branches,
  // each a curved stem carrying pointed, veined leaves in overlapping pairs, meeting below and wide
  // open above, growing in around the title. Inline SVG (no emoji, no new art). Reduced motion: the
  // wreath is simply there.
  let { reduced = false, size = 150 }: { reduced?: boolean; size?: number } = $props();

  const R = 70;
  // Angles on the circle, clockwise from its top: the stem runs from just off the bottom (172°) up
  // the side to 64°, leaving a wide opening at the top (lane V fix round 1 #3).
  const FROM = 172;
  const TO = 64;
  const PAIRS = 7;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const at = (deg: number) => ({ x: R * Math.sin(rad(deg)), y: -R * Math.cos(rad(deg)) });
  const start = at(FROM);
  const end = at(TO);
  // The right branch; the left one is its mirror. Sweep 0: from the bottom up the right side.
  const stem = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${R} ${R} 0 0 0 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  // Each leaf grows from the stem toward the branch's tip: `deg - 90` turns an upright leaf along
  // the stem, then ±34° tilts it outward or inward, so each pair overlaps the next. A last leaf
  // closes the tip.
  const leaves = [
    ...Array.from({ length: PAIRS }, (_, i) => {
      const deg = FROM - 6 - (i * (FROM - TO - 10)) / (PAIRS - 1);
      const p = at(deg);
      return [
        { key: `${i}o`, x: p.x, y: p.y, turn: deg - 90 + 34, i },
        { key: `${i}i`, x: p.x, y: p.y, turn: deg - 90 - 34, i },
      ];
    }).flat(),
    { key: 'tip', x: end.x, y: end.y, turn: TO - 90, i: PAIRS },
  ];
  // A pointed leaf, upright, its base at the origin, 26 long; its vein down the middle.
  const LEAF = 'M0 0 C 6 -6 6 -18 0 -26 C -6 -18 -6 -6 0 0 Z';
  const VEIN = 'M0 -2 L0 -22';
</script>

<svg class="wreath" class:still={reduced} viewBox="-100 -60 200 150" width={size} height={size * 0.75} aria-hidden="true" data-testid="victory-laurel">
  <defs>
    <linearGradient id="laurel-leaf" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#c9a227" />
      <stop offset="1" stop-color="#f1dc9a" />
    </linearGradient>
  </defs>
  {#each [1, -1] as side (side)}
    <g transform="scale({side} 1)">
      <path class="stem" d={stem} />
      {#each leaves as l (l.key)}
        <g transform="translate({l.x.toFixed(1)} {l.y.toFixed(1)}) rotate({l.turn.toFixed(1)})">
          <g class="leaf" style="--i:{l.i}">
            <path class="blade" d={LEAF} fill="url(#laurel-leaf)" />
            <path class="vein" d={VEIN} />
          </g>
        </g>
      {/each}
    </g>
  {/each}
</svg>

<style>
  .wreath {
    display: block;
    margin: 0 auto 4px;
    overflow: visible;
  }
  .stem {
    fill: none;
    stroke: var(--bronze);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .blade {
    stroke: var(--bronze-dark);
    stroke-width: 1.2;
    stroke-linejoin: round;
  }
  .vein {
    fill: none;
    stroke: var(--bronze-dark);
    stroke-width: 0.9;
    opacity: 0.55;
  }
  .leaf {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: leaf-in 0.34s cubic-bezier(0.2, 0.9, 0.3, 1.3) calc(var(--i) * 60ms) both;
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
