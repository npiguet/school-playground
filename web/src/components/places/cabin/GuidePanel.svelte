<script lang="ts">
  // Le guide du camp (spec 2026-09-29 explanations §3, plan R12): five sections in the dragon's voice,
  // rebuilt from the catalogue the server serves (lib/world/guide.ts), so its numbers follow
  // data/regles.json. An open book (the codex contract, Overlay.svelte, Ruling W1): the left page,
  // under the title and the dragon's plate, holds the glory and the seals; the right page the
  // drachmes, the aids and Éris's fights. Each page scrolls on its own.
  // SP4 final review M8: without the catalogue the guide prints no number at all (a client copy could
  // differ from data/regles.json): it says it is opening, or that it cannot, with « Réessayer ».
  import { tick, untrack } from 'svelte';
  import { campStore, loadCatalog } from '../../../lib/world/campStore.svelte';
  import { guideSections, type GuideSection } from '../../../lib/world/guide';

  const LEFT: readonly GuideSection['id'][] = ['gloire', 'sceaux'];
  const sections = $derived(campStore.catalog ? guideSections(campStore.catalog) : null);
  const left = $derived((sections ?? []).filter((s) => LEFT.includes(s.id)));
  const right = $derived((sections ?? []).filter((s) => !LEFT.includes(s.id)));

  // Opening the guide asks again for a catalogue that failed to load (untracked: its arrival must
  // not run this again).
  $effect(() => untrack(() => void loadCatalog()));
  let status = $state<HTMLElement | undefined>();
  let book = $state<HTMLElement | undefined>();
  // The button is gone once it is pressed: the focus goes to « Réessayer » again if the guide still
  // cannot open, else to the book's first title (the spread itself may be `display: contents`, which
  // takes no focus), never to the page.
  async function retry() {
    await loadCatalog();
    await tick();
    (status?.querySelector<HTMLElement>('[data-testid="guide-retry"]') ?? book?.querySelector<HTMLElement>('h3'))?.focus();
  }
</script>

{#snippet page(list: GuideSection[], side: 'left' | 'right')}
  <section class="codex-page page-{side}">
    {#each list as s (s.id)}
      <div class="guide-section" data-testid="guide-{s.id}">
        <h3 class="kit-section" tabindex="-1">{s.title}</h3>
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

{#if sections}
  <div class="codex-spread panel-guide" data-testid="guide" bind:this={book}>
    {@render page(left, 'left')}
    {@render page(right, 'right')}
  </div>
{:else}
  <div class="guide-status" data-testid="guide-status" bind:this={status}>
    {#if campStore.catalogFailed}
      <p class="kit-note" data-tone="eris" role="alert">Le guide ne s'ouvre pas pour l'instant.</p>
      <button type="button" class="kit-bronze is-quiet" data-testid="guide-retry" onclick={retry}>Réessayer</button>
    {:else}
      <p class="kit-note">Le guide s'ouvre…</p>
    {/if}
  </div>
{/if}

<style>
  .guide-status {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
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
