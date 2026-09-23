<script lang="ts">
  import { LEVELS } from '../lib/levels';

  let {
    label,
    value = $bindable(),
    hint,
    id = 'level-select',
  }: { label: string; value: string; hint?: string; id?: string } = $props();
</script>

<div class="field">
  <label for={id}>{label}</label>
  <select {id} bind:value>
    {#each LEVELS as level (level)}
      <option value={level}>{level}</option>
    {/each}
  </select>
  {#if hint}
    <p class="hint muted">{hint}</p>
  {/if}
</div>

<style>
  .field {
    margin-bottom: 16px;
  }
  select {
    width: 100%;
  }
  .hint {
    font-size: 14px;
    margin: 4px 0 0;
  }
</style>
