<script lang="ts">
  // The scribe's desk (immersion wave Task 9, playability #5): the text on the left, and the title,
  // the class and the way to finish on the right, always in view on the iPad. The owl gives the
  // rules (VOICES.desk); a quill gauge counts the words.
  import { untrack } from 'svelte';
  import LevelMedallions from '../../ui/LevelMedallions.svelte';
  import { api, ApiError } from '../../../lib/api';
  import { countWords } from '../../../lib/dictation/segment';
  import { wordGauge } from '../../../lib/library/shelf';
  import { href } from '../../../lib/routes';
  import { go } from '../../../lib/scene/panelNav';
  import type { Profile } from '../../../lib/types';

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
  const gauge = $derived(wordGauge(wordCount));

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
      // The saved parchment waits on the shelves, which replace this form (Back must not reopen
      // it) and keep its history tag (final review I1: closing the shelves then steps back).
      go(href('library', { profileId: String(profile.id) }), 'replace');
    } catch (e) {
      error = e instanceof ApiError ? e.detail : "Les Muses n'ont pas pu poser ce parchemin sur l'étagère.";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="panel-desk">
  <form class="desk" onsubmit={submit}>
    <!-- Playability #5: two columns on the iPad - the text on the left, and the title, the class and
         the way to finish on the right, always in view. -->
    <div class="desk-text">
      <!-- Re-review N5: the owl already says what to write here; the label is for assistive tech. -->
      <label for="body" class="sr-only">Texte</label>
      <textarea
        id="body"
        rows="12"
        autocapitalize="sentences"
        spellcheck="true"
        bind:value={body}
        required
        {...{ autocorrect: 'off' }}
      ></textarea>
      <div class="kit-gauge" data-state={gauge.state} data-testid="desk-gauge" style:--fill="{gauge.fill * 100}%">
        <span class="kit-gauge-track" aria-hidden="true"><span class="kit-gauge-band"></span><span class="kit-gauge-fill"></span></span>
        <span class="kit-gauge-label" aria-live="polite">{gauge.label}</span>
      </div>
    </div>

    <div class="desk-side">
      <!-- Re-review N5: the title is a heading line written on the parchment, not a boxed field. -->
      <div class="field">
        <label for="title" class="sr-only">Titre</label>
        <input id="title" class="title-line" type="text" maxlength="120" placeholder="Le titre de ton parchemin" bind:value={title} required />
      </div>

      <!-- Re-review N8: 48 px medallions, 4 px apart - all seven in one row of the side column. -->
      <LevelMedallions legend="Pour quelle classe{'\u202f?'}" name="desk-level" size="sm" bind:value={level} />

      {#if error}
        <p class="orange" role="alert">{error}</p>
      {/if}

      <button type="submit" class="kit-bronze desk-submit" disabled={submitting || !title.trim() || !body.trim()}>
        Poser sur l'étagère
      </button>

      <!-- Playability #5: the way to finish comes before the optional « Qui l'a écrit ? », so opening
           it never pushes the button out of view. -->
      <details class="who">
        <summary class="kit-link">Qui l'a écrit{'\u202f?'}</summary>
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
      </details>
    </div>
  </form>
</div>

<style>
  .desk {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }
  @media (min-width: 1000px) {
    .desk {
      grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
      align-items: start;
    }
  }
  .desk-text,
  .desk-side {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  textarea {
    width: 100%;
    font-size: 18px;
    resize: vertical;
  }
  /* Playability #5: the title field is full width (it truncated at 240 px). */
  .field input[type='text'] {
    width: 100%;
    min-height: 48px;
  }
  .field {
    margin-bottom: 12px;
  }
  /* A line of ink on the parchment: a bottom rule only (outranks `.kit-form input:not(...)`). */
  .desk-side .field input.title-line {
    border: 0;
    border-bottom: 2px solid var(--form-edge);
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    padding: 6px 2px;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 20px;
  }
  .desk-side .field input.title-line::placeholder {
    color: var(--form-ink-soft);
    font-style: italic;
    font-weight: 400;
  }
  .who summary {
    list-style: none;
  }
  .who summary::-webkit-details-marker {
    display: none;
  }
  .desk-submit {
    align-self: flex-start;
  }
</style>
