<script lang="ts">
  // First-visit welcome cards (spec's decision 22): the Muses, Éris and the dés-accords, the egg.
  // Skippable at any time; never shown again once `settings.onboarded` is true. A comfort
  // feature, not a gate - if the save fails, the modal still closes rather than trap the player.
  import Reveal from './juice/Reveal.svelte';
  import { api } from '../lib/api';
  import { profileStore } from '../lib/profileStore.svelte';
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
      // Onboarding is a comfort feature: close the modal even if the save failed.
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
  <div class="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Bienvenue au camp">
    <div class="parchment onboarding-card">
      {#key step}
        <Reveal>
          <h2>{STEPS[step].title}</h2>
          <p>{STEPS[step].body}</p>
        </Reveal>
      {/key}
      <div class="onboarding-actions">
        <button type="button" class="btn btn-ghost" data-testid="onboarding-skip" onclick={skip}>Passer</button>
        <button type="button" class="btn btn-primary" data-testid="onboarding-next" onclick={next} disabled={closing}>
          {step === STEPS.length - 1 ? 'Entrer au camp' : 'Suivant'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .onboarding-overlay {
    position: fixed;
    inset: 0;
    background: rgba(43, 42, 40, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 50;
  }
  .onboarding-card {
    max-width: 420px;
    width: 100%;
    padding: 28px 24px;
    text-align: center;
  }
  .onboarding-card h2 {
    margin-bottom: 12px;
  }
  .onboarding-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
  }
</style>
