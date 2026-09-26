<script lang="ts">
  // The HUD's quick sound toggles (spec §7, Ruling E8): the lyre button drops a small bronze plate
  // with the three channels and a way to the full lyre. A transient control, no route; closes on
  // Escape, on a tap outside, and on its way to the lyre, giving focus back to the lyre button.
  import Icon from '../ui/Icon.svelte';
  import { audioSettings, bothMuted, setChannel } from '../../lib/audio/store.svelte';
  import { unlockAudio, playSfx } from '../../lib/juice/sfx';
  import { go } from '../../lib/scene/panelNav';
  import { href } from '../../lib/routes';
  import type { ChannelId } from '../../lib/audio/settings';
  import type { IconName } from '../../lib/ui/icons';

  let {
    profileId,
    band = false,
  }: {
    profileId: number;
    /** In the battle's compact band the plate drops below the band, over the parchment. */
    band?: boolean;
  } = $props();

  let open = $state(false);
  let root: HTMLElement | undefined = $state();
  let opener: HTMLButtonElement | undefined = $state();

  const ROWS: { ch: ChannelId; label: string; icon: IconName; iconOff: IconName }[] = [
    { ch: 'music', label: 'Musique', icon: 'music', iconOff: 'music-muted' },
    { ch: 'sfx', label: 'Bruitages', icon: 'bell', iconOff: 'bell-muted' },
    { ch: 'voice', label: 'Voix', icon: 'voice', iconOff: 'voice-muted' },
  ];

  function toggleOpen() {
    unlockAudio();
    open = !open;
  }
  function close(refocus = true) {
    if (!open) return;
    open = false;
    if (refocus) opener?.focus();
  }
  function flip(ch: ChannelId) {
    setChannel(profileId, ch, { muted: !audioSettings[ch].muted });
    if (ch === 'sfx' && !audioSettings.sfx.muted) playSfx('tap');
  }
  function toLyre() {
    close(false);
    go(href('settings', { profileId: String(profileId) }), 'panel');
  }

  $effect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  });
</script>

<div class="sound" bind:this={root}>
  <button
    bind:this={opener}
    type="button"
    class="hud-round"
    data-testid="hud-mute"
    aria-label="Les sons"
    aria-expanded={open}
    aria-controls="hud-sound"
    onclick={toggleOpen}
  >
    <Icon name={bothMuted() ? 'lyre-muted' : 'lyre'} size={28} />
  </button>
  {#if open}
    <div id="hud-sound" class="plate" class:band role="group" aria-label="Les sons du camp" data-testid="hud-sound">
      {#each ROWS as r (r.ch)}
        <button
          type="button"
          class="toggle"
          class:off={audioSettings[r.ch].muted}
          aria-pressed={!audioSettings[r.ch].muted}
          data-testid="hud-sound-{r.ch}"
          onclick={() => flip(r.ch)}
        >
          <Icon name={audioSettings[r.ch].muted ? r.iconOff : r.icon} size={26} />
          <span>{r.label}</span>
        </button>
      {/each}
      <button type="button" class="kit-link to-lyre" data-testid="hud-sound-lyre" onclick={toLyre}>La lyre</button>
    </div>
  {/if}
</div>

<style>
  .sound {
    position: relative;
  }
  /* OverlayVoice's dark plate: night glass in a bronze rim (no kit-plate class exists). */
  .plate {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 220px;
    padding: 8px;
    border: 1px solid var(--bronze-light);
    border-radius: 12px;
    /* Opaque: over the battle's parchment, a see-through plate let Éris's plate show through. */
    background: linear-gradient(180deg, #15121a, #221c28);
    color: var(--bronze-ink);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
  }
  /* The battle's band clips its content: the plate hangs from the viewport, right under the band. */
  .plate.band {
    position: fixed;
    top: calc(var(--vv-top, 0px) + var(--band, 0px) + 8px);
    right: calc(12px + env(safe-area-inset-right));
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 4px 12px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    color: var(--bronze-ink);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 18px;
    font-variant: small-caps;
    letter-spacing: 0.03em;
    text-align: start;
    cursor: pointer;
  }
  .toggle:hover {
    border-color: rgba(201, 171, 116, 0.45);
  }
  .toggle :global(.icon-svg) {
    color: var(--bronze-light);
  }
  /* Off: the icon struck through (its -muted drawing) and at half strength, the words dimmed. */
  .toggle.off :global(.icon-svg) {
    opacity: 0.5;
  }
  .toggle.off span {
    opacity: 0.7;
  }
  .toggle:focus-visible,
  .hud-round:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .to-lyre {
    align-self: flex-end;
    padding: 0 12px;
    color: var(--bronze-light);
  }
</style>
