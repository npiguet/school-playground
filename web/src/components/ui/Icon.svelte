<script lang="ts">
  // An inline line icon of the shared family (lib/ui/icons.ts). Decorative (aria-hidden) unless it
  // gets a `label`; the control around it carries the words.
  import { ICONS, type IconName } from '../../lib/ui/icons';

  let { name, size = 24, label }: { name: IconName; size?: number; label?: string } = $props();
</script>

<svg
  class="icon-svg"
  data-icon={name}
  viewBox="0 0 32 32"
  width={size}
  height={size}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  {#each ICONS[name] as p, i (i)}
    <path
      d={p.d}
      fill={p.fill ? 'currentColor' : 'none'}
      stroke={p.fill ? 'none' : p.halo ? 'var(--icon-halo)' : 'currentColor'}
      stroke-width={p.width ?? 2.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-dasharray={p.dash}
    />
  {/each}
</svg>

<style>
  .icon-svg {
    display: inline-block;
    flex-shrink: 0;
    vertical-align: middle;
  }
</style>
