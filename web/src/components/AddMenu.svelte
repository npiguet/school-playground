<script lang="ts">
  // Bottom-sheet menu opened from the Library FAB (spec's "Decisions" #12): three
  // ways to bring a new parchemin into the library — type it, scan a printed
  // handout, or adopt a chunk from the Bibliothèque d'Alexandrie.
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';

  let { profileId, open = $bindable() }: { profileId: number; open: boolean } = $props();

  function go(name: 'text-new' | 'text-scan' | 'alexandria') {
    open = false;
    navigate(href(name, { profileId: String(profileId) }));
  }

  function close() {
    open = false;
  }
</script>

{#if open}
  <button type="button" class="backdrop" aria-label="Fermer" onclick={close}></button>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Ajouter un parchemin">
    <h2>Ajouter un parchemin</h2>

    <button type="button" class="card menu-item" data-testid="menu-add-type" onclick={() => go('text-new')}>
      <span class="icon" aria-hidden="true">📝</span>
      <span class="text">
        <span class="item-title">Taper ou coller un texte</span>
        <span class="item-subtitle muted">Un texte que tu as sous la main.</span>
      </span>
    </button>

    <button type="button" class="card menu-item" data-testid="menu-add-scan" onclick={() => go('text-scan')}>
      <span class="icon" aria-hidden="true">📷</span>
      <span class="text">
        <span class="item-title">Scanner une feuille</span>
        <span class="item-subtitle muted">Prends en photo une feuille imprimée (pas de manuscrit).</span>
      </span>
    </button>

    <button
      type="button"
      class="card menu-item"
      data-testid="menu-add-alexandria"
      onclick={() => go('alexandria')}
    >
      <span class="icon" aria-hidden="true">📜</span>
      <span class="text">
        <span class="item-title">Bibliothèque d'Alexandrie</span>
        <span class="item-subtitle muted">Des textes classiques recopiés pour toi.</span>
      </span>
    </button>

    <button type="button" class="btn btn-ghost close-btn" onclick={close}>Fermer</button>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(43, 42, 40, 0.45);
    border: none;
    padding: 0;
    margin: 0;
    z-index: 20;
    cursor: pointer;
  }
  .sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-radius: var(--radius) var(--radius) 0 0;
    padding: 16px;
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    box-shadow: 0 -2px 12px rgba(43, 42, 40, 0.25);
    z-index: 21;
  }
  .sheet h2 {
    margin-top: 0;
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 56px;
    margin-bottom: 12px;
  }
  .icon {
    font-size: 28px;
    line-height: 1;
    flex-shrink: 0;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .item-title {
    font-weight: 600;
    font-family: var(--font-display);
  }
  .item-subtitle {
    font-size: 14px;
  }
  .close-btn {
    width: 100%;
    margin-top: 4px;
  }
</style>
