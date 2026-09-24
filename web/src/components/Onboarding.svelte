<script lang="ts">
  // First-visit welcome cards (spec's decision 22): the Muses, Éris and the dés-accords, the egg.
  // Skippable at any time; never shown again once `settings.onboarded` is true. A comfort
  // feature, not a gate - if the save fails, the card still closes rather than trap the player.
  // Playability #3: staged in the world rather than as a form - the Muses speak from a torn
  // parchment docked low over a barely dimmed camp, with the bronze kit buttons of the dialogue
  // box. Logic and test ids are unchanged.
  // Fix wave 2: a real modal, through the same `modal` action as Overlay - the camp behind is
  // inert, Tab stays on the card, and focus goes back where it was when the card closes.
  import Reveal from './juice/Reveal.svelte';
  import { api } from '../lib/api';
  import { profileStore } from '../lib/profileStore.svelte';
  import { modal } from '../lib/scene/overlayState.svelte';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  const STEPS = [
    {
      title: 'Les Muses ont choisi un héros : toi.',
      body: 'Tu protèges les textes contre Éris, la déesse de la Discorde.',
    },
    {
      title: 'Éris sème des dés-accords.',
      body: "Un -s oublié, un a pour un à… Ses lieutenants sont chacun une ruse. Relis, une chose à la fois, et ils tombent.",
    },
    {
      title: "Un œuf t'a été confié.",
      body: "Il éclora quand tu auras neutralisé la première ruse d'Éris. Tu lui donneras un nom.",
    },
  ];

  let step = $state(0);
  let closing = $state(false);
  let visible = $state(true);

  async function finish() {
    if (closing) return;
    closing = true;
    try {
      const updated = await api.profiles.patch(profile.id, { settings: { onboarded: true } });
      profileStore.current = updated;
    } catch {
      // Onboarding is a comfort feature: close the card even if the save failed.
    } finally {
      visible = false;
      closing = false;
    }
  }

  function next() {
    if (step < STEPS.length - 1) step += 1;
    else void finish();
  }

  function skip() {
    void finish();
  }
</script>

{#if visible}
  <div
    class="onboarding-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Bienvenue au camp"
    tabindex="-1"
    data-testid="onboarding"
    use:modal
  >
    <div class="onboarding-card" data-testid="onboarding-card">
      <p class="speaker">Les Muses</p>
      {#key step}
        <Reveal>
          <h2>{STEPS[step].title}</h2>
          <p class="body">{STEPS[step].body}</p>
        </Reveal>
      {/key}
      <div class="onboarding-actions">
        <span class="steps" aria-hidden="true">
          {#each STEPS as _, i (i)}<span class="dot" class:on={i === step}></span>{/each}
        </span>
        <button type="button" class="kit-bronze quiet" data-testid="onboarding-skip" onclick={skip}>Passer</button>
        <button type="button" class="kit-bronze" data-testid="onboarding-next" onclick={next} disabled={closing}>
          {step === STEPS.length - 1 ? 'Entrer au camp' : 'Suivant'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* A light veil (about 30 %), so the camp stays visible behind the Muses' words. */
  .onboarding-overlay {
    position: fixed;
    inset: 0;
    outline: none;
    background: rgba(21, 18, 26, 0.3);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 20px 20px calc(4vh + env(safe-area-inset-bottom));
    z-index: 50;
  }
  /* Torn parchment: the kit's parchment colours, ragged top and bottom edges. */
  .onboarding-card {
    max-width: 620px;
    width: 100%;
    padding: 26px 30px 24px;
    text-align: left;
    color: var(--ink);
    font-family: var(--font-body);
    background:
      radial-gradient(ellipse at 20% 0%, rgba(255, 255, 255, 0.35), transparent 60%),
      radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(140, 100, 40, 0.16)),
      linear-gradient(180deg, var(--parchment-solid), #e9d6ae);
    clip-path: polygon(
      0% 0.4px,
      6.2% 5px,
      12.5% 0.8px,
      18.8% 5.2px,
      25% 0.2px,
      31.2% 4.8px,
      37.5% 2.1px,
      43.8% 5px,
      50% 2.2px,
      56.2% 4.9px,
      62.5% 1.1px,
      68.8% 6.3px,
      75% 1.6px,
      81.2% 6.5px,
      87.5% 2.5px,
      93.8% 5px,
      100% 0.3px,
      100% calc(100% - 1.3px),
      93.8% calc(100% - 3.6px),
      87.5% calc(100% - 1.2px),
      81.2% calc(100% - 6.2px),
      75% calc(100% - 2.9px),
      68.8% calc(100% - 4px),
      62.5% calc(100% - 0.6px),
      56.2% calc(100% - 5.6px),
      50% calc(100% - 0.6px),
      43.8% calc(100% - 6.3px),
      37.5% calc(100% - 2.3px),
      31.2% calc(100% - 5px),
      25% calc(100% - 3.2px),
      18.8% calc(100% - 7px),
      12.5% calc(100% - 1.4px),
      6.2% calc(100% - 4.2px),
      0% calc(100% - 3.1px)
    );
    filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.4));
  }
  .speaker {
    margin: 0 0 4px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  .onboarding-card h2 {
    margin: 0 0 8px;
    font-family: var(--font-display);
    font-size: 24px;
  }
  .body {
    margin: 0;
    font-size: 20px;
    line-height: 1.4;
  }
  .onboarding-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
  }
  .steps {
    display: inline-flex;
    gap: 6px;
    margin-right: auto;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--bronze);
  }
  .dot.on {
    background: var(--bronze);
  }
  /* « Passer » stays a bronze button, only quieter than « Suivant ». */
  .quiet {
    filter: saturate(0.6) brightness(0.95);
  }
</style>
