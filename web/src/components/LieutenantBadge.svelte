<script lang="ts">
  // A lieutenant's painted icon in a small bronze ring: the ONE place the lieutenants' icons come
  // from (UI3 Ruling A13; was the server's emoji `glyph` + five client copies). `dim` greys a
  // lieutenant that still sleeps at the hero's level. An unknown key shows Éris herself.
  import { ART, lieutenantIcon } from '../lib/world/art';

  let { lieutenantKey, size = 40, dim = false }: { lieutenantKey: string; size?: number; dim?: boolean } = $props();

  const src = $derived(lieutenantIcon(lieutenantKey) ?? ART.erisSmug);
</script>

<span class="lt-badge" class:dim style="width:{size}px;height:{size}px" data-lieutenant={lieutenantKey} aria-hidden="true">
  <img {src} alt="" draggable="false" />
</span>

<style>
  .lt-badge {
    display: inline-flex;
    flex-shrink: 0;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--bronze-light);
    background: radial-gradient(circle at 40% 35%, #f6ecd6, #d9c39a);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  .lt-badge img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .lt-badge.dim img {
    filter: grayscale(1);
    opacity: 0.55;
  }
</style>
