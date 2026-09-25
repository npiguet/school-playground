<script lang="ts">
  import Avatar from '../../Avatar.svelte';
  import LevelMedallions from '../../ui/LevelMedallions.svelte';
  import { api, ApiError } from '../../../lib/api';
  import { AVATARS, LEVELS } from '../../../lib/levels';
  import { markUnlocked } from '../../../lib/profileStore.svelte';
  import { href } from '../../../lib/routes';
  import { replaceRoute } from '../../../lib/router.svelte';
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
      // history entry is replaced by the camp instead of pushing a new one.
      replaceRoute(href('camp', { profileId: String(profile.id) }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        error = 'Ce nom est déjà pris.';
      } else if (e instanceof ApiError) {
        error = `Les Muses n'ont pas pu créer ce héros : ${e.detail}`;
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
    <div class="forge-preview" aria-hidden="true">
      <span class="forge-shield"><img data-testid="forge-emblem" src={avatarIcon(avatar)} alt="" /></span>
      <span class="forge-banner" data-testid="forge-banner">{name.trim() || 'Ton prénom'}</span>
    </div>

    <div class="forge-fields">
      <div class="field">
        <label for="name">Ton prénom</label>
        <input id="name" type="text" maxlength="30" autocapitalize="words" bind:value={name} required />
      </div>

      <fieldset class="field">
        <legend>Ton emblème</legend>
        <div class="avatars">
          {#each AVATARS as a (a)}
            <label class="avatar-choice" class:selected={avatar === a}>
              <input type="radio" name="avatar" value={a} bind:group={avatar} />
              <Avatar avatar={a} size={56} ring />
              <span>{avatarLabel(a)}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <LevelMedallions legend="Ta classe" name="level" bind:value={level} />

      <div class="seal">
        <button type="button" class="kit-link" aria-expanded={sealOpen} aria-controls="seal-field" onclick={toggleSeal}>
          Protéger ton bouclier d'un sceau
        </button>
        {#if sealOpen}
          <div class="field" id="seal-field">
            <label for="pin">Ton sceau à quatre chiffres</label>
            <input
              id="pin"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="4"
              autocomplete="new-password"
              value={pin}
              oninput={onPinInput}
            />
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
    gap: 24px;
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
  /* Her name on a cloth banner across the shield's foot. */
  .forge-banner {
    max-width: 230px;
    margin-top: -26px;
    padding: 6px 30px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: linear-gradient(180deg, #a5532f, #7e3b20);
    color: var(--bronze-ink);
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 20px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 0 100%, 14px 50%);
  }
  .field {
    margin-bottom: 18px;
  }
  .field input[type='text'] {
    width: 100%;
    min-height: 48px;
    font-size: 19px;
  }
  fieldset {
    border: none;
    padding: 0;
    margin: 0 0 18px;
  }
  legend {
    margin-bottom: 8px;
    padding: 0;
  }
  .avatars {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  /* Medallions without card boxes (playability #3). */
  .avatar-choice {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 64px;
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
  .forge-submit {
    margin-top: 6px;
  }
  .hint {
    font-size: 15px;
    margin: 4px 0 0;
  }
  #pin {
    width: 160px;
    letter-spacing: 0.4em;
    -webkit-text-security: disc;
  }
</style>
