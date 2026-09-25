<script lang="ts">
  import LevelSelect from '../../LevelSelect.svelte';
  import Avatar from '../../Avatar.svelte';
  import { api, ApiError } from '../../../lib/api';
  import { AVATARS, LEVELS } from '../../../lib/levels';
  import { markUnlocked } from '../../../lib/profileStore.svelte';
  import { href } from '../../../lib/routes';
  import { replaceRoute } from '../../../lib/router.svelte';

  let name = $state('');
  let avatar = $state(AVATARS[0]);
  let level = $state(LEVELS[0]);
  let pin = $state('');
  let error = $state('');
  let submitting = $state(false);

  function avatarLabel(a: string): string {
    return a.charAt(0).toUpperCase() + a.slice(1);
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
  <form onsubmit={submit}>
    <div class="field">
      <label for="name">Ton prénom</label>
      <input
        id="name"
        type="text"
        maxlength="30"
        autocapitalize="words"
        bind:value={name}
        required
      />
    </div>

    <fieldset class="field">
      <legend>Ton avatar</legend>
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

    <LevelSelect label="Ton niveau" bind:value={level} hint="HarmoS, comme à l'école" id="level" />

    <div class="field">
      <label for="pin">Un code à quatre chiffres (facultatif)</label>
      <input
        id="pin"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="4"
        value={pin}
        oninput={onPinInput}
      />
      <p class="hint muted">Pour que ton frère ou ta sœur ne joue pas sur ton profil.</p>
    </div>

    {#if error}
      <p class="orange" role="alert">{error}</p>
    {/if}

    <button type="submit" class="btn btn-primary" disabled={submitting || !name.trim()}>
      Rejoindre le camp
    </button>
  </form>
</div>

<style>
  .field {
    margin-bottom: 20px;
  }
  fieldset {
    border: none;
    padding: 0;
  }
  legend {
    font-weight: 600;
    margin-bottom: 8px;
    padding: 0;
  }
  .avatars {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .avatar-choice {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px;
    border-radius: var(--radius);
    border: 2px solid var(--parchment-edge);
    cursor: pointer;
    font-weight: normal;
    min-width: 72px;
  }
  .avatar-choice.selected {
    border-color: var(--bronze);
    background: rgba(200, 148, 80, 0.2);
  }
  .avatar-choice input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .hint {
    font-size: 14px;
    margin: 4px 0 0;
  }
</style>
