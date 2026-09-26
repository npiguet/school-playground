<script lang="ts">
  // One channel of « Les sons du camp » (spec §7): a real range input (0-100, step 5) and a
  // « Sourdine » toggle. Applies at once; the slider saves once it rests and on release (Ruling E2).
  import { audioSettings, setChannel } from '../../../lib/audio/store.svelte';
  import { playSfx } from '../../../lib/juice/sfx';
  import type { ChannelId } from '../../../lib/audio/settings';

  let { profileId, channel, label, volumeLabel }: { profileId: number; channel: ChannelId; label: string; volumeLabel: string } = $props();

  const value = $derived(Math.round(audioSettings[channel].volume * 100));
  const set = (e: Event, live: boolean) => setChannel(profileId, channel, { volume: Number((e.currentTarget as HTMLInputElement).value) / 100 }, { live });
</script>

<div class="channel" data-testid="lyre-channel-{channel}">
  <span class="channel-name">{label}</span>
  <input
    type="range"
    min="0"
    max="100"
    step="5"
    aria-label={volumeLabel}
    data-testid="lyre-volume-{channel}"
    {value}
    oninput={(e) => set(e, true)}
    onchange={(e) => {
      set(e, false);
      if (channel === 'sfx') playSfx('tap');
    }}
  />
  <button
    type="button"
    class="kit-bronze is-quiet mute"
    aria-pressed={audioSettings[channel].muted}
    data-testid="lyre-mute-{channel}"
    onclick={() => setChannel(profileId, channel, { muted: !audioSettings[channel].muted })}>Sourdine</button
  >
</div>

<style>
  .channel {
    display: grid;
    grid-template-columns: minmax(7.5rem, auto) 1fr auto;
    align-items: center;
    gap: 14px;
    margin-bottom: 6px;
  }
  .channel-name {
    font-weight: 600;
  }
  /* Bronze on parchment, with a finger-sized hit area (the track stays thin). */
  input[type='range'] {
    width: 100%;
    min-width: 0;
    height: 48px;
    margin: 0;
    accent-color: var(--bronze);
    cursor: pointer;
  }
  /* Pressed in: the channel is muted. */
  .mute[aria-pressed='true'] {
    background: linear-gradient(180deg, var(--bronze-dark) 0%, var(--bronze) 100%);
    color: var(--bronze-ink);
    box-shadow:
      inset 0 2px 5px rgba(0, 0, 0, 0.45),
      inset 0 -1px 0 rgba(255, 240, 200, 0.25);
    transform: translateY(1px);
  }
</style>
