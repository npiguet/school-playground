<script lang="ts">
  // The slim scene HUD (scenes UI spec §4): hero chip (opens the hero panel), XP laurel, dragon
  // mini-portrait, sound toggle. Anchored to the on-screen part of the art box (SceneStage's
  // .stage-hud, final review M13), inside the safe-area insets.
  // UI5 Ruling E8: the lyre opens the sound plate (three channels).
  // Task 10b round 1 #3: the dragon's ambient status (what it's up to) lives on the camp-dragon
  // hotspot's caption instead of a `title` here (see camp.ts) - a `title` tooltip never shows on
  // iPad, the target device, since there's no mouse hover to trigger it.
  // The purse beside the laurel (spec 2026-09-29 drachmes §1, R14): the painted coin and the balance.
  import type { Snippet } from 'svelte';
  import Avatar from '../Avatar.svelte';
  import LaurelBar from '../ui/LaurelBar.svelte';
  import SoundPlate from './SoundPlate.svelte';
  import { ART, MARK_ICONS } from '../../lib/world/art';
  import { TINT_FILTERS } from '../../lib/world/dragon';
  import { hudDrachmes, hudXp } from '../../lib/scene/hud';
  import { href } from '../../lib/routes';
  import type { CampResponse } from '../../lib/world/types';
  import type { Profile } from '../../lib/types';

  let {
    profile,
    camp,
    onHero,
    band = false,
    lead,
  }: {
    profile: Profile;
    camp: CampResponse | null;
    onHero: () => void;
    /** The battle's compact band (UI4 I4): the controls sit either side of the hold bar, which takes
     *  the centre (the XP laurel steps aside), and the hero chip shows its avatar only. */
    band?: boolean;
    /** Rendered before the hero chip in the band (the battle's « Le camp »). */
    lead?: Snippet;
  } = $props();

  const xp = $derived(camp ? hudXp(camp.xp, camp.dragon.stage) : null);
  const purse = $derived(camp ? hudDrachmes(camp.drachmes) : null);
</script>

{#snippet hero()}
  <button type="button" class="hud-hero" data-testid="hud-hero" aria-label="Ton héros{'\u202f: '}{profile.name}" onclick={onHero}>
    <Avatar avatar={profile.avatar} size={40} ring />
    <span class="hud-name">{profile.name}</span>
  </button>
{/snippet}

<header class="hud" class:band>
  {#if band}
    <div class="hud-left">{@render lead?.()}{@render hero()}</div>
  {:else}
    {@render hero()}
  {/if}
  <div class="hud-center">
    {#if xp && !band}
      <LaurelBar value={xp.value} max={xp.max} label={xp.label} testId="hud-xp" />
    {/if}
    {#if purse && !band}
      <!-- R14: the painted coin and the balance, right of the laurel; not a link. -->
      <span class="hud-drachmes" data-testid="hud-drachmes" role="img" aria-label={purse.label}>
        <img src={MARK_ICONS.drachme} alt="" draggable="false" /><span aria-hidden="true">{purse.text}</span>
      </span>
    {/if}
  </div>
  <div class="hud-right">
    {#if camp}
      <a
        class="hud-round hud-dragon"
        data-testid="hud-dragon"
        href={href('dragon', { profileId: String(profile.id) })}
        aria-label="Ton dragon"
      >
        <img src={ART.dragon[camp.dragon.stage]} alt="" style="filter:{TINT_FILTERS[camp.dragon.tint]}" />
      </a>
    {/if}
    <!-- Playability #9: a bronze lyre (struck through when music and effects are muted), not an emoji. -->
    <SoundPlate profileId={profile.id} {band} />
  </div>
</header>

<style>
  .hud {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 5;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    padding: calc(8px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) 8px
      calc(12px + env(safe-area-inset-left));
    background: linear-gradient(rgba(21, 18, 26, 0.7), rgba(21, 18, 26, 0));
    pointer-events: none;
  }
  .hud > * {
    pointer-events: auto;
  }
  .hud-hero {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 4px 14px 4px 4px;
    border-radius: 999px;
    border: 1px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.6);
    color: var(--bronze-ink);
    cursor: pointer;
  }
  /* Playability #10: Alegreya small caps are much narrower than Cinzel caps, and the chip may
     grow to ~260 px, so real names such as « Anne-Charlotte » fit whole. */
  .hud-name {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 18px;
    font-variant: small-caps;
    letter-spacing: 0.03em;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hud-center {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .hud-drachmes {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 2px 12px 2px 4px;
    border-radius: 999px;
    border: 1px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.6);
    color: var(--bronze-ink);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 18px;
    white-space: nowrap;
  }
  .hud-drachmes img {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }
  .hud-right {
    justify-self: end;
    display: flex;
    gap: 10px;
  }
  /* Global under the HUD: SoundPlate's opener wears it too. */
  .hud :global(.hud-round) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 2px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.6);
    font-size: 22px;
    color: var(--bronze-light);
    cursor: pointer;
  }
  .hud-dragon img {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
  /* The battle's compact band (I4): the band's own height, no gradient, the centre column as wide
     as the hold bar (the stage's --hp-w), each side's controls centred in its column. */
  .hud.band {
    inset: 0;
    padding: 0 calc(12px + env(safe-area-inset-right)) 0 calc(12px + env(safe-area-inset-left));
    grid-template-columns: 1fr calc(var(--hp-w, 30vw) + 24px) 1fr;
    background: none;
  }
  .hud.band .hud-left {
    justify-self: center;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .hud.band .hud-right {
    justify-self: center;
  }
  .hud.band .hud-hero {
    padding: 4px;
  }
  .hud.band .hud-name {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
