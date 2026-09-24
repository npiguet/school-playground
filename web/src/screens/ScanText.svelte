<script lang="ts">
  // Scan flow (spec §3.2, §5): capture photo(s) of a printed handout -> verify the OCR text
  // against the paper -> save with optional due date (a *dictée préparée* becomes a prophecy,
  // spec's "Decisions" #14). The reference text is always the answer key, so the verify step
  // is not a formality: an uncorrected OCR mistake would silently become "correct" forever.
  import { onDestroy } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import LevelSelect from '../components/LevelSelect.svelte';
  import { api, ApiError } from '../lib/api';
  import { todayIso } from '../lib/dates';
  import { countWords } from '../lib/dictation/segment';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import type { Profile, ScanResult } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  let step = $state<'capture' | 'verify' | 'details'>('capture');

  // --- Step 1: capture -----------------------------------------------------------------
  interface Photo {
    file: File;
    url: string;
  }
  let photos = $state<Photo[]>([]);
  let uploading = $state(false);
  let uploadError = $state('');

  function onFilesChosen(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    for (const file of Array.from(input.files ?? [])) {
      photos.push({ file, url: URL.createObjectURL(file) });
    }
    input.value = ''; // lets the player pick the same file again (e.g. after removing it)
  }

  function removePhoto(i: number) {
    URL.revokeObjectURL(photos[i].url);
    photos.splice(i, 1);
  }

  function clearPhotos() {
    for (const p of photos) URL.revokeObjectURL(p.url);
    photos = [];
    uploadError = '';
  }

  onDestroy(() => {
    for (const p of photos) URL.revokeObjectURL(p.url);
  });

  let scanResult = $state<ScanResult | null>(null);
  let text = $state('');

  async function readText() {
    if (photos.length === 0 || uploading) return;
    uploading = true;
    uploadError = '';
    try {
      const result = await api.scan.upload(photos.map((p) => p.file));
      scanResult = result;
      text = result.text;
      step = 'verify';
    } catch (e) {
      uploadError =
        e instanceof ApiError ? e.detail : "Les scribes n'ont pas réussi à lire cette feuille.";
    } finally {
      uploading = false;
    }
  }

  // --- Step 2: verify --------------------------------------------------------------------
  const lowConfidence = $derived(
    scanResult ? Array.from(new Set(scanResult.pages.flatMap((p) => p.low_confidence))) : [],
  );
  const wordCount = $derived(countWords(text));

  function retakePhotos() {
    step = 'capture';
    scanResult = null;
    uploadError = '';
  }

  // --- Step 3: details ---------------------------------------------------------------------
  let title = $state('');
  let level = $state(profile.level);
  let dueDate = $state('');
  let author = $state('');
  let work = $state('');
  let saving = $state(false);
  let saveError = $state('');

  async function saveScan(event: SubmitEvent) {
    event.preventDefault();
    if (saving || !scanResult) return;
    saving = true;
    saveError = '';
    try {
      await api.texts.create({
        title: title.trim(),
        body: text.trim(),
        level,
        source: 'scan',
        scan_id: scanResult.scan_id,
        due_date: dueDate || null,
        author: author.trim() || null,
        work: work.trim() || null,
        added_by_profile_id: profile.id,
      });
      navigate(href('library', { profileId: String(profile.id) }));
    } catch (e) {
      saveError = e instanceof ApiError ? e.detail : "Les Muses n'ont pas pu sauvegarder ce parchemin.";
    } finally {
      saving = false;
    }
  }
</script>

<TopBar {profile} title="Scanner une feuille" />

<div class="screen">
  {#if step === 'capture'}
    <div class="card explain">
      <p>
        Prends la feuille imprimée en photo, bien à plat et en pleine lumière. Une photo par
        page. L'écriture à la main ne marche pas.
      </p>
    </div>

    <div class="capture-buttons">
      <label class="btn btn-primary capture-label">
        Prendre une photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          data-testid="scan-input"
          class="file-input"
          onchange={onFilesChosen}
        />
      </label>
      <label class="btn">
        Choisir dans les photos
        <input type="file" accept="image/*" multiple class="file-input" onchange={onFilesChosen} />
      </label>
    </div>

    {#if photos.length > 0}
      <div class="thumbs">
        {#each photos as p, i (p.url)}
          <div class="thumb">
            <img src={p.url} alt={`Photo ${i + 1}`} />
            <button type="button" class="btn btn-ghost" onclick={() => removePhoto(i)}>Retirer</button>
          </div>
        {/each}
      </div>
    {/if}

    {#if uploadError}
      <p class="orange" role="alert">{uploadError}</p>
      <button type="button" class="btn" onclick={clearPhotos}>Reprendre les photos</button>
    {/if}

    <button
      type="button"
      class="btn btn-primary read-btn"
      data-testid="btn-scan-read"
      disabled={photos.length === 0 || uploading}
      onclick={readText}
    >
      Lire le texte
    </button>
    {#if uploading}
      <p class="muted" aria-live="polite">Les scribes déchiffrent la feuille…</p>
    {/if}
  {:else if step === 'verify' && scanResult}
    <h2>Vérifie le texte avec la feuille</h2>

    <div class="verify-grid">
      <div class="photos">
        {#each scanResult.pages as page (page.index)}
          <img
            src={api.scan.pageUrl(scanResult.scan_id, page.index)}
            alt={`Page ${page.index}`}
            class="photo"
          />
        {/each}
      </div>

      <div class="text-col">
        {#if lowConfidence.length > 0}
          <p class="verify-label">
            À vérifier :
            <span class="chips" data-testid="scan-low-confidence">
              {#each lowConfidence as w (w)}<span class="chip chip-warn">{w}</span>{/each}
            </span>
          </p>
        {/if}
        <textarea
          data-testid="scan-textarea"
          lang="fr"
          autocapitalize="sentences"
          spellcheck="false"
          rows="14"
          bind:value={text}
          {...{ autocorrect: 'off' }}
        ></textarea>
        <p class="wordcount muted">{wordCount} mots</p>
        <p class="hint muted">
          Corrige chaque mot qui diffère de la feuille : ce texte devient la clé de correction.
        </p>
      </div>
    </div>

    <div class="actions">
      <button type="button" class="btn" onclick={retakePhotos}>Reprendre une photo</button>
      <button
        type="button"
        class="btn btn-primary"
        data-testid="btn-scan-verified"
        disabled={wordCount < 5}
        onclick={() => (step = 'details')}
      >
        Le texte est juste
      </button>
    </div>
  {:else if step === 'details'}
    <h2>Détails du parchemin</h2>
    <form onsubmit={saveScan}>
      <div class="field">
        <label for="scan-title-input">Titre</label>
        <input
          id="scan-title-input"
          type="text"
          maxlength="120"
          data-testid="scan-title"
          bind:value={title}
          required
        />
      </div>

      <LevelSelect label="Niveau" bind:value={level} id="scan-level" />

      <div class="field">
        <label for="scan-due-date-input">Dictée pour le</label>
        <input
          id="scan-due-date-input"
          type="date"
          data-testid="scan-due-date"
          min={todayIso()}
          bind:value={dueDate}
        />
        <p class="hint muted">
          Si c'est une dictée préparée, indique la date du test : elle devient une prophétie de
          l'Oracle.
        </p>
      </div>

      <div class="field">
        <label for="scan-author">Auteur</label>
        <input id="scan-author" type="text" maxlength="120" bind:value={author} />
      </div>

      <div class="field">
        <label for="scan-work">Œuvre</label>
        <input id="scan-work" type="text" maxlength="120" bind:value={work} />
      </div>

      {#if saveError}
        <p class="orange" role="alert">{saveError}</p>
      {/if}

      <button type="submit" class="btn btn-primary" data-testid="btn-scan-save" disabled={saving || !title.trim()}>
        Sauvegarder dans les Parchemins
      </button>
    </form>
  {/if}
</div>

<style>
  .explain {
    margin-bottom: 20px;
    cursor: default;
  }
  .explain p {
    margin: 0;
  }
  .capture-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }
  .capture-label {
    position: relative;
  }
  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }
  .thumb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .thumb img {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: var(--radius);
    border: 1px solid var(--marble-dark);
  }
  .read-btn {
    width: 100%;
  }
  .verify-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }
  @media (min-width: 900px) {
    .verify-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .photos {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .photo {
    width: 100%;
    object-fit: contain;
    max-height: 70vh;
    border-radius: var(--radius);
    border: 1px solid var(--marble-dark);
    background: #fff;
  }
  .verify-label {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    margin: 0 0 10px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip-warn {
    border-color: var(--orange);
    color: var(--orange);
    font-weight: 600;
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
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .field {
    margin-bottom: 20px;
  }
</style>
