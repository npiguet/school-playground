<script lang="ts">
  import { AVATAR_GLYPHS, type Avatar } from '../lib/levels';

  // `ring`: the in-world look (playability #4) - the glyph sits in a bronze medallion instead of
  // the legacy pale-blue disc. Scene UI (HUD, hero panel) uses it; legacy screens keep the disc.
  let { avatar, size = 48, ring = false }: { avatar: Avatar | string; size?: number; ring?: boolean } = $props();
</script>

<span
  class="avatar"
  class:ring
  style="width: {size}px; height: {size}px; font-size: {size * 0.55}px;"
  aria-hidden="true"
>
  {AVATAR_GLYPHS[avatar as Avatar] ?? '🦉'}
</span>

<style>
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--aegean-light);
    line-height: 1;
    flex-shrink: 0;
  }
  .avatar.ring {
    box-sizing: border-box;
    border: 3px solid var(--bronze-light);
    background: radial-gradient(circle at 40% 35%, #5a4630, var(--night) 75%);
    box-shadow:
      inset 0 0 0 1px var(--bronze-dark),
      0 0 0 1px var(--bronze-dark),
      0 2px 6px rgba(0, 0, 0, 0.4);
  }
</style>
