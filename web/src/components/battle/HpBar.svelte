<script lang="ts">
  // The opponent's hold on the text (UI4 Ruling C3): full while she plays, notched by Palamède's count,
  // dropping only at the reckoning. Éris's violet, never red; a meter for assistive tech.
  import { hpPercent, type HpView } from '../../lib/battle/hp';

  let { name, label, hp }: { name: string; label: string; hp: HpView } = $props();
  const ticks = $derived(hp.segments && hp.segments > 1 ? Array.from({ length: hp.segments - 1 }, (_, i) => (i + 1) / hp.segments!) : []);
</script>

<!-- The plaque names the opponent and is the battle's h1 (M8), as a place's plaque is; it sits
     outside the meter, whose children assistive tech flattens. -->
<div class="hp-bar stage-text" data-testid="battle-hold">
  <h1 class="hp-name kit-plaque" data-testid="battle-plaque">{name}</h1>
  <div
    class="hp-track"
    data-testid="battle-hp"
    role="meter"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={hpPercent(hp)}
    data-segments={hp.segments ?? ''}
  >
    <span class="hp-fill" style:transform="scaleX({hp.value})"></span>
    {#each ticks as t (t)}<span class="hp-tick" style:left="{t * 100}%"></span>{/each}
  </div>
</div>

<style>
  .hp-bar {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  .hp-name {
    align-self: center;
    margin: 0;
    font-size: 15px;
    line-height: 1.3;
    padding: 2px 12px;
  }
  .hp-track {
    position: relative;
    /* A 12 px fill inside the bronze rim (UI4 playability #20: 8-10 px read thin from the text). */
    height: 16px;
    border-radius: 8px;
    background: rgba(21, 18, 26, 0.72);
    border: 2px solid var(--bronze-light);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }
  .hp-fill {
    position: absolute;
    inset: 0;
    transform-origin: left center;
    background: linear-gradient(180deg, #8a4fb5, var(--violet) 60%, var(--violet-dark));
    transition: transform 0.35s cubic-bezier(0.3, 0.7, 0.4, 1);
  }
  .hp-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--bronze-ink);
    opacity: 0.8;
  }
</style>
