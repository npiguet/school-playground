<script lang="ts">
  import { untrack } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import LevelSelect from '../components/LevelSelect.svelte';
  import { api, ApiError } from '../lib/api';
  import { countWords } from '../lib/dictation/segment';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  let title = $state('');
  let body = $state('');
  // Local, editable copy of the hero's level: seeded once from `profile` (the form field below
  // then owns it), so it must not track `profile.level` afterwards - untrack() makes that intent
  // explicit to the compiler instead of leaving it to look like an accidental one-shot read.
  let level = $state(untrack(() => profile.level));
  let author = $state('');
  let work = $state('');
  let translator = $state('');
  let error = $state('');
  let submitting = $state(false);

  const wordCount = $derived(countWords(body));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    error = '';
    try {
      await api.texts.create({
        title: title.trim(),
        body: body.trim(),
        level,
        source: 'custom',
        author: author.trim() || null,
        work: work.trim() || null,
        translator: translator.trim() || null,
        added_by_profile_id: profile.id,
      });
      navigate(href('library', { profileId: String(profile.id) }));
    } catch (e) {
      error = e instanceof ApiError ? e.detail : "Les Muses n'ont pas pu sauvegarder ce parchemin.";
    } finally {
      submitting = false;
    }
  }
</script>

<TopBar {profile} title="Nouveau parchemin" />

<div class="screen">
  <form onsubmit={submit}>
    <div class="field">
      <label for="title">Titre</label>
      <input id="title" type="text" maxlength="120" bind:value={title} required />
    </div>

    <div class="field">
      <label for="body">Texte</label>
      <textarea
        id="body"
        rows="12"
        autocapitalize="sentences"
        spellcheck="true"
        bind:value={body}
        required
        {...{ autocorrect: 'off' }}
      ></textarea>
      <p class="wordcount muted">{wordCount} mots</p>
      <p class="hint muted">Entre quatre-vingts et deux cents mots, nombres écrits en lettres.</p>
    </div>

    <LevelSelect label="Niveau" bind:value={level} id="level" />

    <div class="field">
      <label for="author">Auteur</label>
      <input id="author" type="text" maxlength="120" bind:value={author} />
    </div>

    <div class="field">
      <label for="work">Œuvre</label>
      <input id="work" type="text" maxlength="120" bind:value={work} />
    </div>

    <div class="field">
      <label for="translator">Traducteur</label>
      <input id="translator" type="text" maxlength="120" bind:value={translator} />
    </div>

    {#if error}
      <p class="orange" role="alert">{error}</p>
    {/if}

    <button type="submit" class="btn btn-primary" disabled={submitting || !title.trim() || !body.trim()}>
      Sauvegarder dans les Parchemins
    </button>
  </form>
</div>

<style>
  .field {
    margin-bottom: 20px;
  }
  textarea {
    width: 100%;
    font-size: 18px;
    font-family: var(--font-body);
    resize: vertical;
  }
  .wordcount {
    margin: 6px 0 0;
    font-weight: 600;
  }
  .hint {
    font-size: 14px;
    margin: 2px 0 0;
  }
</style>
