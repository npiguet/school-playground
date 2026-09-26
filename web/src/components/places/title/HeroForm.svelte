<script lang="ts">
  import Avatar from '../../Avatar.svelte';
  import Icon from '../../ui/Icon.svelte';
  import LevelMedallions from '../../ui/LevelMedallions.svelte';
  import SealSlots from '../../ui/SealSlots.svelte';
  import { api, ApiError } from '../../../lib/api';
  import { AVATARS, LEVELS } from '../../../lib/levels';
  import { markUnlocked } from '../../../lib/profileStore.svelte';
  import { href } from '../../../lib/routes';
  import { leavePanel } from '../../../lib/scene/panelNav';
  import { avatarIcon } from '../../../lib/world/art';

  let name = $state('');
  let avatar = $state(AVATARS[0]);
  let level = $state(LEVELS[0]);
  let pin = $state('');
  let error = $state('');
  let submitting = $state(false);
  let sealOpen = $state(false);

  function avatarLabel(a: string): string {
    return a.charAt(0).toUpperCase() + a.slice(1);
  }

  function toggleSeal() {
    sealOpen = !sealOpen;
    if (!sealOpen) pin = ''; // a closed seal is never sent
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    error = '';
    try {
      const profile = await api.profiles.create({
        name: name.trim(),
        avatar,
        level,
        pin: pin ? pin : null,
      });
      markUnlocked(profile.id);
      // Ruling A2: Back from the camp never reopens an emptied form - the ritual overlay's own
      // history entry is replaced by the camp instead of pushing a new one, and that entry drops the
      // overlay's panel tag (WebKit would keep it).
      leavePanel(href('camp', { profileId: String(profile.id) }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        error = 'Ce nom est déjà pris.';
      } else if (e instanceof ApiError) {
        error = `Les Muses n'ont pas pu créer ce héros\u202f: ${e.detail}`;
      } else {
        error = "Les Muses n'ont pas pu créer ce héros.";
      }
    } finally {
      submitting = false;
    }
  }

  function onPinInput(event: Event) {
    pin = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
  }
</script>

<div class="hero-form">
  <form class="forge" onsubmit={submit}>
    <!-- Playability #3: the shield that will hang on the gate, forged live. -->
    <!-- Re-review N5: she writes her name on the banner itself - the ribbon is the input. -->
    <div class="forge-preview">
      <span class="forge-shield" aria-hidden="true"><img data-testid="forge-emblem" src={avatarIcon(avatar)} alt="" /></span>
      <label for="name" class="sr-only">Ton prénom</label>
      <span class="forge-banner-wrap">
        <input
          id="name"
          class="forge-banner"
          data-testid="forge-banner"
          type="text"
          maxlength="30"
          autocapitalize="words"
          placeholder="Ton prénom"
          bind:value={name}
          required
        />
      </span>
    </div>

    <div class="forge-fields">
      <!-- Re-review N3: the emblem is the personal choice, so it is the big medallion row; the class
           (LevelMedallions size="sm") reads as secondary. -->
      <fieldset class="field">
        <legend class="caption">Choisis ton emblème</legend>
        <div class="avatars">
          {#each AVATARS as a (a)}
            <label class="avatar-choice" class:selected={avatar === a}>
              <input type="radio" name="avatar" value={a} bind:group={avatar} />
              <Avatar avatar={a} size={60} ring />
              <span>{avatarLabel(a)}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <LevelMedallions legend="Ta classe" name="level" size="sm" bind:value={level} />

      <div class="seal">
        <button
          type="button"
          class="kit-link seal-toggle"
          aria-expanded={sealOpen}
          aria-controls={sealOpen ? 'seal-field' : undefined}
          onclick={toggleSeal}
        >
          <Icon name="chevron" size={14} />
          Protéger ton bouclier d'un sceau
        </button>
        {#if sealOpen}
          <!-- Re-review N5: the same four wax slots as the seal she will break at the gate. -->
          <div class="field seal-field" id="seal-field">
            <label for="pin" class="caption">Ton sceau à quatre chiffres</label>
            <SealSlots id="pin" value={pin} oninput={onPinInput} autocomplete="new-password" testId="forge-seal" />
            <p class="hint muted">Personne d'autre que toi ne pourra l'ouvrir.</p>
          </div>
        {/if}
      </div>

      {#if error}
        <p class="orange" role="alert">{error}</p>
      {/if}

      <button type="submit" class="kit-bronze forge-submit" disabled={submitting || !name.trim()}>Accrocher mon bouclier</button>
    </div>
  </form>
</div>

<style>
  .forge {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
  }
  @media (min-width: 760px) {
    .forge {
      grid-template-columns: 240px 1fr;
      align-items: start;
    }
  }
  .forge-preview {
    position: sticky;
    top: 0;
    display: grid;
    justify-items: center;
    gap: 0;
    padding-top: 8px;
  }
  /* The hoplite shield that will hang on the gate: the chosen emblem at its boss. */
  .forge-shield {
    display: grid;
    place-items: center;
    width: 190px;
    height: 190px;
    border-radius: 50%;
    border: 5px solid var(--bronze-dark);
    background: radial-gradient(circle at 38% 32%, var(--bronze-light), var(--bronze) 58%, var(--bronze-dark));
    box-shadow:
      inset 0 0 0 8px rgba(255, 240, 200, 0.18),
      inset 0 0 0 10px var(--bronze-dark),
      0 8px 18px rgba(0, 0, 0, 0.45);
  }
  .forge-shield img {
    width: 62%;
    height: 62%;
    object-fit: contain;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5));
  }
  /* Her name on a cloth banner across the shield's foot - re-review N5: the banner IS the name
     field. The cloth is the wrapper's ::before (its clip-path would also clip a focus ring drawn on
     the input), and the ring goes round the wrapper. */
  .forge-banner-wrap {
    position: relative;
    isolation: isolate;
    display: block;
    width: 230px;
    margin-top: -26px;
  }
  .forge-banner-wrap::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(180deg, #a5532f, #7e3b20);
    clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 0 100%, 14px 50%);
  }
  .forge-banner-wrap:focus-within {
    outline: 3px solid var(--gold-light);
    outline-offset: 3px;
    border-radius: 4px;
  }
  /* Outranks `.kit-form input:not(...)` (the parchment field look) with the component's classes. */
  .forge .forge-preview input.forge-banner {
    width: 100%;
    min-height: 48px;
    padding: 6px 28px;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    outline: none;
    color: var(--bronze-ink);
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 20px;
    text-align: center;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  /* B2 fix round 1 #5: the placeholder (no name typed yet) reads as a hint, not an answer. */
  .forge .forge-preview input.forge-banner::placeholder {
    color: rgba(255, 240, 220, 0.72);
    font-style: italic;
  }
  /* B2 fix round 1 #2: a tighter rhythm keeps the submit button on screen with the seal open, at
     1180x820 and 1280x720. */
  .field {
    margin-bottom: 0;
  }
  fieldset {
    border: none;
    padding: 0;
    margin: 0 0 1px;
  }
  legend {
    margin-bottom: 1px;
    padding: 0;
  }
  .avatars {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  /* Medallions without card boxes (playability #3). */
  .avatar-choice {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 84px;
    padding: 4px;
    border-radius: 12px;
    font-variant: normal;
    font-weight: 600;
    cursor: pointer;
  }
  .avatar-choice.selected :global(.avatar) {
    box-shadow:
      0 0 0 3px var(--gold-light),
      0 0 14px rgba(255, 220, 140, 0.8);
  }
  .avatar-choice input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .avatar-choice:focus-within {
    outline: 3px solid var(--bronze-light);
    outline-offset: 2px;
  }
  .seal {
    margin-bottom: 1px;
  }
  /* B2 fix round 1 #4: a visual open/closed cue, flush with the other field labels (kit-link's own
     padding would otherwise indent it 8px from them). */
  .seal-toggle {
    margin-left: -8px;
  }
  .seal-toggle :global(.icon-svg) {
    transition: transform 0.15s ease;
  }
  .seal-toggle[aria-expanded='true'] :global(.icon-svg) {
    transform: rotate(180deg);
  }
  .forge-submit {
    margin-top: 0;
  }
  .hint {
    font-size: 15px;
    margin: 0;
  }
  .seal-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  @media (prefers-reduced-motion: reduce) {
    .seal-toggle :global(.icon-svg) {
      transition: none;
    }
  }
</style>
