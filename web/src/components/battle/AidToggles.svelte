<script lang="ts">
  // The five review aids on the muster (spec 2026-09-29 §3, §5): each taken along or left at the camp.
  // Wide: five compact rows (a 40 px emblem, the name with, on its line, « Emporter » while taken or the
  // « +20 % » tag while left, one line of description under it). Narrow: one row of five 48 px emblem
  // toggles with their names under them, the tag in the corner, the focused one's line below. A
  // suggested aid is ringed; the choice is always the child's (never changed from here). Plan Ruling
  // R4: the toggle's accessible name is the aid's name alone, `aria-pressed` says taken, and its
  // description is its own line (`aid-desc-<key>`), in both layouts.
  import { untrack } from 'svelte';
  import { AID_KEYS, AID_LABELS, aidDesc, aidIcon, type AidKey } from '../../lib/aids';
  import { MUSTER } from '../../lib/battle/lines';
  import type { GameRules } from '../../lib/rules';

  let {
    aids = $bindable(),
    rules,
    wide,
    highlight = null,
  }: { aids: AidKey[]; rules: GameRules; wide: boolean; highlight?: AidKey | null } = $props();

  let focused = $state<AidKey>(untrack(() => highlight) ?? 'argus');

  function toggle(key: AidKey) {
    aids = aids.includes(key) ? aids.filter((k) => k !== key) : AID_KEYS.filter((k) => k === key || aids.includes(k));
    focused = key;
  }
</script>

<fieldset class="aids" class:wide data-testid="muster-aids" data-tour-part="aids">
  <legend class="section">{MUSTER.aidsHeading}</legend>
  <div class="list">
    {#each AID_KEYS as key (key)}
      {@const taken = aids.includes(key)}
      <button
        type="button"
        class="aid"
        class:taken
        class:suggested={highlight === key}
        data-testid="aid-toggle-{key}"
        data-suggested={highlight === key ? 'true' : undefined}
        aria-label={AID_LABELS[key].name}
        aria-pressed={taken}
        aria-describedby="aid-desc-{key}"
        onclick={() => toggle(key)}
        onfocus={() => (focused = key)}
        onpointerenter={() => (focused = key)}
      >
        <img class="emblem" src={aidIcon(key)} alt="" />
        <span class="name">{AID_LABELS[key].name}</span>
        <span class="side" aria-hidden="true">
          {#if !taken}<span class="kit-tag bonus" data-testid="aid-bonus-{key}">{MUSTER.bonusTag(rules.aid_bonus)}</span>
          {:else if wide}<span class="state">{MUSTER.take}</span>{/if}
        </span>
        <span class="desc" id="aid-desc-{key}" hidden={!wide}>{aidDesc(key, rules)}</span>
      </button>
    {/each}
  </div>
  {#if !wide}<p class="focused-desc" data-testid="aid-desc" aria-hidden="true">{aidDesc(focused, rules)}</p>{/if}
</fieldset>

<style>
  .aids {
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
  .list {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
  }
  .wide .list {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
  /* Narrow: the emblem over its name, the « +20 % » tag pinned to the toggle's corner. */
  .aid {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-height: 48px;
    padding: 4px;
    border-radius: 10px;
    border: 2px solid rgba(138, 90, 40, 0.25);
    background: rgba(255, 250, 238, 0.45);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .aid .side {
    position: absolute;
    top: 2px;
    right: 2px;
  }
  /* Wide: a compact row, the emblem beside the name (with the choice and its tag on the name's line)
     and the one line of description under both. */
  .wide .aid {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    grid-template-areas:
      'emblem name side'
      'emblem desc desc';
    align-items: center;
    column-gap: 10px;
    row-gap: 0;
    padding: 3px 10px;
    text-align: left;
  }
  .wide .aid .side {
    position: static;
    grid-area: side;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .aid.taken {
    border-color: var(--gold);
    background: rgba(255, 247, 222, 0.96);
  }
  .aid:not(.taken) .emblem {
    opacity: 0.45;
    filter: grayscale(0.6);
  }
  .aid.suggested {
    box-shadow: 0 0 0 3px var(--gold-light), 0 0 12px rgba(255, 220, 140, 0.7);
  }
  .aid:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .emblem {
    flex: none;
    width: 48px;
    height: 48px;
    object-fit: contain;
  }
  .wide .emblem {
    grid-area: emblem;
    width: 40px;
    height: 40px;
  }
  .name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 14px;
    line-height: 1.15;
    text-align: center;
  }
  .wide .name {
    grid-area: name;
    font-size: 15px;
    text-align: left;
  }
  .desc {
    grid-area: desc;
    font-size: 14px;
    line-height: 1.2;
    color: var(--ink-soft);
  }
  .state {
    font-size: 13px;
    font-style: italic;
    color: var(--ink-soft);
    white-space: nowrap;
  }
  /* A small tag: the kit's, with its punched hole centred on one line and no cord. */
  .bonus {
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
  .focused-desc {
    margin: 4px 0 0;
    font-size: 15px;
    color: var(--ink-soft);
    text-align: center;
  }
</style>
