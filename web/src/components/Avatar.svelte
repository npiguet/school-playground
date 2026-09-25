<script lang="ts">
  // A hero's emblem: the painted avatar medallion (UI3 Ruling A13, was an emoji). `ring`: the
  // in-world look (playability #4) - the emblem sits in a bronze ring. Unknown keys show the owl.
  import { avatarIcon } from '../lib/world/art';
  import type { Avatar } from '../lib/levels';

  let { avatar, size = 48, ring = false }: { avatar: Avatar | string; size?: number; ring?: boolean } = $props();
</script>

<span class="avatar" class:ring style="width: {size}px; height: {size}px;" aria-hidden="true">
  <img src={avatarIcon(avatar)} alt="" draggable="false" />
</span>

<style>
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--aegean-light);
    overflow: hidden;
    flex-shrink: 0;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: contain;
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
