<script lang="ts">
  // The three paces as bronze medallions (UI4 Task 3; Ruling C8's names; pace IV retired by the pace
  // redesign): real radios, the label is the tap target. `minPace` (SP3 Task 7): in a boss fight the
  // slower paces stay visible, locked, with the reason. Spec 2026-09-29 §5: each shows its bonus tag;
  // `row` (the narrow muster, plan Ruling R6) puts the three side by side with the chosen one's
  // description under them. A locked pace shows its reason, never a bonus it cannot pay.
  import { PACES, PACE_LABELS, type Pace } from '../../lib/dictation/script';
  import { MUSTER } from '../../lib/battle/lines';

  let {
    pace = $bindable(),
    minPace = 1,
    bonuses,
    row = false,
  }: { pace: Pace; minPace?: Pace; bonuses: Record<Pace, number>; row?: boolean } = $props();
  const ROMAN = ['', 'I', 'II', 'III'];
</script>

<fieldset class="paces" class:row data-tour-part="pace">
  <legend class="section">{MUSTER.paceHeading}</legend>
  <div class="grid" role="radiogroup" aria-label="Rythme de la dictée">
    {#each PACES as p (p)}
      {@const disabled = p < minPace}
      <label class="pace" class:selected={pace === p} class:disabled data-testid="pace-option-{p}">
        <input type="radio" name="pace" value={p} checked={pace === p} {disabled} onchange={() => (pace = p)} />
        <span class="kit-medallion seal" aria-hidden="true">{ROMAN[p]}</span>
        <span class="words">
          <span class="title-line">
            <span class="title">{PACE_LABELS[p].title}</span>
            {#if bonuses[p] > 0 && !disabled}<span class="kit-tag bonus" data-testid="pace-bonus-{p}">{MUSTER.bonusTag(bonuses[p])}</span>{/if}
          </span>
          {#if !row || disabled}<span class="desc">{disabled ? MUSTER.paceLocked : PACE_LABELS[p].description}</span>{/if}
        </span>
      </label>
    {/each}
  </div>
  {#if row}<p class="row-desc" data-testid="pace-desc">{PACE_LABELS[pace].description}</p>{/if}
</fieldset>

<style>
  .paces {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .section {
    margin: 0 0 6px;
    padding: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  /* Three paces, one under the other (I to III, the order they quicken in): each description on a line
     or two, where two columns left the third medallion alone on its row. */
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
  .pace {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 5px 12px;
    border-radius: 10px;
    border: 2px solid rgba(138, 90, 40, 0.25);
    background: rgba(255, 250, 238, 0.72);
    color: var(--ink);
    cursor: pointer;
  }
  .pace input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .pace.selected {
    border-color: var(--gold);
    background: rgba(255, 247, 222, 0.96);
    box-shadow: 0 0 0 3px rgba(212, 166, 58, 0.25);
  }
  .pace.selected .seal {
    border-color: var(--gold-light);
    box-shadow:
      0 0 0 3px var(--gold-light),
      0 0 12px rgba(255, 220, 140, 0.7),
      inset 0 0 0 3px rgba(255, 240, 200, 0.35);
  }
  .pace:has(input:focus-visible) {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .pace.disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  /* A bare disc (no input inside): the kit medallion's coin, at the tap row's size. */
  .seal {
    flex: none;
    width: 48px;
    height: 48px;
    cursor: inherit;
  }
  .words {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .title {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 16px;
  }
  .desc {
    font-size: 14px;
    color: var(--ink-soft);
    line-height: 1.25;
  }
  /* The bonus tag rides on the title's line (wide), or under the title (the narrow row). */
  .title-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 2px 8px;
  }
  .row .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .row .pace {
    gap: 8px;
    padding: 5px 8px;
  }
  .row .disabled .desc {
    font-size: 12px;
    line-height: 1.15;
  }
  .row .title-line {
    flex-direction: column;
    align-items: flex-start;
  }
  .bonus {
    flex: none;
    font-size: 13px;
    padding: 1px 8px 1px 18px;
    --tag-tilt: 0deg;
  }
  .bonus::before {
    left: 6px;
    top: calc(50% - 3px);
    width: 6px;
    height: 6px;
  }
  .bonus::after {
    display: none;
  }
  .row-desc {
    margin: 2px 0 0;
    font-size: 14px;
    line-height: 1.3;
    color: var(--ink-soft);
    text-align: center;
  }
</style>
