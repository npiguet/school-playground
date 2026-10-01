<script lang="ts">
  // Le guide du camp (spec 2026-09-29 explanations §3, plan R12): five sections in the dragon's voice,
  // rebuilt from the catalogue the server serves (lib/world/guide.ts), so its numbers follow
  // data/regles.json. An open book (the codex contract, Overlay.svelte, Ruling W1): the left page,
  // under the title and the dragon's plate, holds the glory and the seals; the right page the
  // drachmes, the aids and Éris's fights. Each page scrolls on its own.
  import { campStore } from '../../../lib/world/campStore.svelte';
  import { guideSections, type GuideSection } from '../../../lib/world/guide';

  const LEFT: readonly GuideSection['id'][] = ['gloire', 'sceaux'];
  const sections = $derived(guideSections(campStore.catalog));
  const left = $derived(sections.filter((s) => LEFT.includes(s.id)));
  const right = $derived(sections.filter((s) => !LEFT.includes(s.id)));
</script>

{#snippet page(list: GuideSection[], side: 'left' | 'right')}
  <section class="codex-page page-{side}">
    {#each list as s (s.id)}
      <div class="guide-section" data-testid="guide-{s.id}">
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
      </div>
    {/each}
  </section>
{/snippet}

<div class="codex-spread panel-guide" data-testid="guide">
  {@render page(left, 'left')}
  {@render page(right, 'right')}
</div>

<style>
  .panel-guide .guide-section + .guide-section {
    margin-top: 18px;
  }
  .panel-guide .guide-section > :first-child {
    margin-top: 0;
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
