<script lang="ts">
  // A reward medallion: gold ring + glyph over a radial gradient (plan decision 12 -
  // relics/gear/decor are CSS medallions, no extra art). `locked` greys it out and
  // swaps the glyph for a "?" so an undiscovered reward reads as a mystery, never a
  // blank.
  let {
    glyph,
    kind,
    size = 72,
    locked = false,
  }: { glyph: string; kind: 'relic' | 'gear' | 'decor' | 'tint'; size?: number; locked?: boolean } = $props();
</script>

<div
  class="medallion"
  class:locked
  data-kind={kind}
  style="width:{size}px;height:{size}px;font-size:{size * 0.5}px"
  role={locked ? 'img' : undefined}
  aria-label={locked ? 'Récompense à découvrir' : undefined}
>
  <span aria-hidden="true">{locked ? '?' : glyph}</span>
</div>

<style>
  .medallion {
    border-radius: 50%;
    border: 3px solid var(--gold);
    background: radial-gradient(circle at 35% 30%, var(--gold-light), var(--gold) 70%);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    flex-shrink: 0;
  }

  .medallion.locked {
    filter: grayscale(1);
    background: radial-gradient(circle at 35% 30%, #ececec, #b8b8b8 70%);
    color: var(--ink-soft);
    border-color: #b8b8b8;
  }
</style>
