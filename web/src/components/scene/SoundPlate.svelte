<script lang="ts">
  // The HUD's quick sound toggles (spec §7, Ruling E8): the lyre button drops a small bronze plate
  // with the three channels and a way to the full lyre. A transient control, no route; closes on
  // Escape, on a tap outside, and on its way to the lyre, giving focus back to the lyre button.
  import { untrack } from 'svelte';
  import Icon from '../ui/Icon.svelte';
  import { overlayState } from '../../lib/scene/overlayState.svelte';
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
  let plate: HTMLElement | undefined = $state();
  // UI5 playability #1: the plaque hangs from the lyre button, its notch right under the button's
  // centre. In the battle's band the plate hangs from the viewport (the band clips), so its right
  // edge is lined up with the button's too.
  let hang = $state<{ right: number | null; notch: number }>({ right: null, notch: 15 });

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
    if (!open || !plate || !opener) return;
    const b = opener.getBoundingClientRect();
    const right = band ? Math.max(8, Math.round(document.documentElement.clientWidth - b.right)) : null;
    // The notch's 16 px square, centred under the button: `right` counts from inside the plate's
    // 3 px rim, and the square's centre is 8 px left of its right edge.
    const plateRight = band ? b.right : plate.getBoundingClientRect().right;
    hang = { right, notch: Math.round(plateRight - 3 - (b.left + b.width / 2) - 8) };
  });

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

  // A popover, never under a modal: a tour or a panel that opens (a tour starts once the camp data
  // arrives, maybe while the plate is open) closes it. Otherwise the plate would stay open under the
  // inert stage, and the next tap would both close it (outside) and move the tour on (anywhere).
  // (Under a modal the stage is inert, so the plate cannot be opened there.)
  $effect(() => {
    if (overlayState.open > 0) untrack(() => close(false));
  });

  // Lane A review #8: Tab (or any move of focus) out of the plate closes it. Only a focus that lands
  // somewhere else counts: Safari moves focus to nothing on a tap, which the outside tap above covers.
  function onFocusOut(e: FocusEvent) {
    const to = e.relatedTarget as Node | null;
    if (open && to && root && !root.contains(to)) close(false);
  }
</script>

<div class="sound" bind:this={root} onfocusout={onFocusOut}>
  <button
    bind:this={opener}
    type="button"
    class="hud-round"
    data-testid="hud-mute"
    aria-label="Les sons"
    aria-expanded={open}
    aria-controls={open ? 'hud-sound' : undefined}
    onclick={toggleOpen}
  >
    <Icon name={bothMuted() ? 'lyre-muted' : 'lyre'} size={28} />
  </button>
  {#if open}
    <div
      bind:this={plate}
      id="hud-sound"
      class="plate"
      class:band
      role="group"
      aria-label="Les sons du camp"
      data-testid="hud-sound"
      style:right={hang.right === null ? undefined : `${hang.right}px`}
      style:--notch="{hang.notch}px"
    >
      <!-- UI5 playability #2: the lyre's words. A row says its state (« en marche », « en sourdine »),
           and a silenced row sits pressed into the bronze, as the lyre's « Sourdine » does when pressed.
           The state word is for the eye: `aria-pressed` (playing) already says it to a screen reader. -->
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
          <span class="name">{r.label}</span>
          <span class="state" data-testid="hud-sound-{r.ch}-state" aria-hidden="true">{audioSettings[r.ch].muted ? 'en sourdine' : 'en marche'}</span>
        </button>
      {/each}
      <button type="button" class="to-lyre" data-testid="hud-sound-lyre" onclick={toLyre}>Ouvrir la lyre</button>
    </div>
  {/if}
</div>

<style>
  .sound {
    position: relative;
  }
  /* UI5 playability #1: a bronze plaque hung from the lyre button (it was night glass, and read as
     the system's dropdown menu). A cast body with a dark rim and a lit top edge, a rivet in each
     corner, a notch under the button, engraved words and engraved lines between the rows. Opaque:
     over the battle's parchment, a see-through plate let Éris's plate show through. */
  .plate {
    --rivet: radial-gradient(circle at 40% 38%, #f6e3ad 0, #c89450 1.5px, #5a3a18 3.5px, rgba(90, 58, 24, 0) 4.5px);
    position: absolute;
    top: calc(100% + 14px);
    right: 0;
    z-index: 6;
    display: flex;
    flex-direction: column;
    min-width: 260px;
    padding: 14px 14px 12px;
    border: 3px solid #4a2e12;
    border-radius: 10px;
    background:
      var(--rivet) left 3px top 3px / 10px 10px no-repeat,
      var(--rivet) right 3px top 3px / 10px 10px no-repeat,
      var(--rivet) left 3px bottom 3px / 10px 10px no-repeat,
      var(--rivet) right 3px bottom 3px / 10px 10px no-repeat,
      linear-gradient(180deg, #8a5a2b, #5e3a1a);
    color: var(--bronze-ink);
    box-shadow:
      inset 0 1px 0 rgba(255, 236, 200, 0.55),
      inset 0 0 0 1px rgba(255, 236, 200, 0.12),
      0 8px 18px rgba(0, 0, 0, 0.45);
  }
  /* The notch: a bronze tab rising from the top edge, under the lyre button's centre. */
  .plate::before {
    content: '';
    position: absolute;
    top: -11px;
    right: var(--notch, 15px);
    box-sizing: border-box;
    width: 16px;
    height: 16px;
    border-top: 3px solid #4a2e12;
    border-left: 3px solid #4a2e12;
    border-radius: 3px 0 0 0;
    background: #8a5a2b;
    box-shadow: inset 1px 1px 0 rgba(255, 236, 200, 0.5);
    transform: rotate(45deg);
    pointer-events: none;
  }
  /* The battle's band clips its content: the plate hangs from the viewport, right under the band,
     its right edge lined up with the lyre button's (set from the button, see `hang`). */
  .plate.band {
    position: fixed;
    top: calc(var(--vv-top, 0px) + var(--band, 0px) + 14px);
    right: calc(12px + env(safe-area-inset-right));
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 4px 12px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--bronze-ink);
    font-family: var(--font-body);
    text-align: start;
    text-shadow: 0 1px 0 rgba(40, 22, 8, 0.85);
    cursor: pointer;
  }
  /* Engraved lines between the rows: a dark cut with a lit lip under it. */
  .toggle + .toggle {
    border-top: 1px solid rgba(40, 22, 8, 0.7);
    border-radius: 0 0 6px 6px;
    box-shadow: inset 0 1px 0 rgba(255, 236, 200, 0.2);
  }
  .name {
    font-weight: 700;
    font-size: 18px;
    font-variant: small-caps;
    letter-spacing: 0.03em;
  }
  .state {
    margin-inline-start: auto;
    padding-inline-start: 12px;
    font-size: 15px;
    font-style: italic;
    white-space: nowrap;
  }
  .toggle :global(.icon-svg) {
    color: var(--gold-light);
    filter: drop-shadow(0 1px 0 rgba(40, 22, 8, 0.85));
  }
  /* Silenced: pressed into the bronze, like the lyre's « Sourdine » when pressed; the icon struck
     through (its -muted drawing), the row says « en sourdine ». */
  .toggle.off {
    background: rgba(40, 22, 8, 0.4);
    box-shadow:
      inset 0 2px 5px rgba(0, 0, 0, 0.5),
      inset 0 -1px 0 rgba(255, 236, 200, 0.15);
  }
  .toggle.off :global(.icon-svg) {
    opacity: 0.75;
  }
  /* A finger leaves a sticky :hover on iPad: the glow is for a mouse only. */
  @media (hover: hover) {
    .toggle:hover {
      background-color: rgba(255, 236, 200, 0.08);
    }
  }
  .toggle:focus-visible,
  .to-lyre:focus-visible,
  .hud-round:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  /* A small parchment button set into the bronze (it was an underlined web link). */
  .to-lyre {
    align-self: flex-end;
    min-height: 48px;
    margin-top: 10px;
    padding: 6px 16px;
    border: 1px solid #4a2e12;
    border-radius: 8px;
    background: linear-gradient(180deg, #f8efd9, #e8d6b0);
    color: var(--bronze-dark);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.04em;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      0 2px 4px rgba(0, 0, 0, 0.4);
    cursor: pointer;
  }
</style>
