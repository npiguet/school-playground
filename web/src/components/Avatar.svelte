<script lang="ts">
  import { AVATAR_GLYPHS, type Avatar } from '../lib/levels';

  let { avatar, size = 48 }: { avatar: Avatar | string; size?: number } = $props();
</script>

<span
  class="avatar"
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
</style>
