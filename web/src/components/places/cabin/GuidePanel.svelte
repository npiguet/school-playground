<script lang="ts">
  // Le guide du camp (spec 2026-09-29 explanations §3, plan R12): five sections in the dragon's voice,
  // rebuilt from the catalogue the server serves (lib/world/guide.ts), so its numbers follow
  // data/regles.json.
  import { campStore } from '../../../lib/world/campStore.svelte';
  import { guideSections } from '../../../lib/world/guide';

  const sections = $derived(guideSections(campStore.catalog));
</script>

<div class="panel-guide" data-testid="guide">
  {#each sections as s (s.id)}
    <section data-testid="guide-{s.id}">
      <h3 class="kit-section">{s.title}</h3>
      {#each s.blocks as b, i (i)}
        {#if b.kind === 'p'}
          <p>{b.text}</p>
        {:else}
          <ul>
            {#each b.items as item (item)}<li>{item}</li>{/each}
          </ul>
        {/if}
      {/each}
    </section>
  {/each}
</div>

<style>
  .panel-guide section + section {
    margin-top: 18px;
  }
  .panel-guide p {
    margin: 8px 0 0;
  }
  .panel-guide ul {
    margin: 8px 0 0;
    padding-left: 22px;
  }
  .panel-guide li + li {
    margin-top: 4px;
  }
</style>
