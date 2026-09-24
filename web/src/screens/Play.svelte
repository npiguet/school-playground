<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import PaceSelect from '../components/PaceSelect.svelte';
  import Dictation from '../components/Dictation.svelte';
  import Proofreading from '../components/Proofreading.svelte';
  import Results from '../components/Results.svelte';
  import { api, ApiError } from '../lib/api';
  import { debounce } from '../lib/debounce';
  import { buildPlan, defaultPace, type DictationPlan } from '../lib/dictation/script';
  import { pickVoice, ttsAvailable, unlockSpeech, waitForVoices } from '../lib/dictation/tts';
  import { gradeSession } from '../lib/grading/grade';
  import type { Annotation, SessionResult } from '../lib/grading/types';
  import { clearPlayState, loadPlayState, newPlayState, savePlayState, type PlayState } from '../lib/playState';
  import { loadProfile } from '../lib/profileStore.svelte';
  import { navigate } from '../lib/router.svelte';
  import { href } from '../lib/routes';
  import type { Profile, StatsResponse, TextFull, TrapWord } from '../lib/types';

  let { profile, textId }: { profile: Profile; textId: string } = $props();

  const id = $derived(Number(textId));
  const helpStage = $derived(Math.min(4, Math.max(1, Math.round(profile.help_stage))) as 1 | 2 | 3 | 4);

  let text = $state<TextFull | null>(null);
  let trapWords = $state<TrapWord[]>([]);
  let stats = $state<StatsResponse | null>(null);
  let plan = $state<DictationPlan | null>(null);
  let voice = $state<SpeechSynthesisVoice | null>(null);
  let playState = $state<PlayState | null>(null);
  let showResumeBanner = $state(false);
  let loading = $state(true);
  let error = $state('');
  let result = $state<SessionResult | null>(null);
  let helpMessage = $state<string | null>(null);
  let submitError = $state<string | null>(null);
  let submitting = $state(false);
  // Set once the player has explicitly left this session (toLibrary/clearPlayState): guards a
  // still-in-flight submitSession() from resurrecting the play state into localStorage after
  // it was deliberately cleared. Unlike a replay (which swaps `playState` for a fresh object,
  // already caught by the identity check below), toLibrary() clears storage but keeps the same
  // `playState` reference, so it needs its own flag.
  let left = false;

  async function load() {
    loading = true;
    error = '';
    try {
      const [t, tw, st] = await Promise.all([
        api.texts.get(id),
        api.profiles.trapWords(profile.id),
        api.profiles.stats(profile.id),
      ]);
      text = t;
      trapWords = tw;
      stats = st;
      plan = buildPlan(t.body);

      const saved = loadPlayState(profile.id, id);
      if (saved) {
        playState = saved;
        showResumeBanner = saved.phase !== 'results';
      } else {
        playState = newPlayState(profile.id, id, defaultPace(profile.level));
      }
      if (playState.phase === 'results') void ensureResults();

      const voices = await waitForVoices();
      voice = pickVoice(voices, profile.settings.voice ?? null) ?? null;
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }

  load();

  function save() {
    if (playState) savePlayState(playState);
  }

  // P1-3: the draft used to be saved only on phase changes, so a reload/backgrounding while
  // still typing lost it entirely and "Continuer" restored an empty textarea. Debounced (rather
  // than saved on every keystroke) so a fast typist doesn't hit localStorage constantly.
  const saveDraftDebounced = debounce(save, 800);
  $effect(() => {
    if (playState?.phase !== 'dictation') return;
    void playState.draft; // tracked: reruns the debounce on every keystroke
    saveDraftDebounced();
  });

  function restart() {
    clearPlayState(profile.id, id);
    playState = newPlayState(profile.id, id, defaultPace(profile.level));
    showResumeBanner = false;
    result = null;
    helpMessage = null;
    submitError = null;
    left = false;
  }

  function toLibrary() {
    left = true;
    clearPlayState(profile.id, id);
    navigate(href('library', { profileId: String(profile.id) }));
  }

  // Tapped from the resume banner, which is itself a tap - a safe place to
  // unlock iOS speech even when we're resuming straight into the dictation
  // phase (whose own Dictation.svelte onMount starts the runner with no
  // further user gesture available).
  function continueSession() {
    unlockSpeech();
    showResumeBanner = false;
  }

  // iOS Safari only allows speechSynthesis to start from inside a user
  // gesture - unlockSpeech() must run synchronously, first, in this handler.
  function startDictation() {
    unlockSpeech();
    if (!playState) return;
    playState.startedAt = new Date().toISOString();
    playState.phase = 'dictation';
    save();
  }

  // P1-4: "Quitter" on the dictation screen. The draft is already saved (debounced, P1-3);
  // this just makes leaving explicit and re-shows the resume banner, exactly as a fresh page
  // load with a saved 'dictation' state would.
  function quitDictation() {
    save();
    showResumeBanner = true;
  }

  function onDictationFinish() {
    if (!playState) return;
    playState.current = playState.draft;
    playState.phase = 'proofreading';
    save();
  }

  function onProofreadingDone() {
    if (!playState) return;
    playState.phase = 'results';
    save();
    void ensureResults();
  }

  function computeResult() {
    if (!text || !playState) return;
    result = gradeSession(text.body, playState.draft, playState.current, text.annotation as Annotation, {
      paceLevel: playState.pace,
    });
  }

  async function submitSession() {
    if (!text || !playState || !result || submitting) return;
    // Snapshotted so that, after the await, we can tell whether the player replayed (a new
    // PlayState object) or left (see `left` above) while this request was in flight - in either
    // case the response below must not mutate/save a session that's no longer the current one.
    const stateAtSubmit = playState;
    const resultAtSubmit = result;
    resultAtSubmit.tools = {
      hints: stateAtSubmit.hintsUsed,
      threadsDrawn: stateAtSubmit.fil?.drawn ?? 0,
      threadsCorrect: stateAtSubmit.fil?.correct ?? 0,
    };
    submitting = true;
    submitError = null;
    try {
      const created = await api.sessions.create({
        profile_id: profile.id,
        text_id: id,
        pace_level: stateAtSubmit.pace,
        help_stage: profile.help_stage,
        started_at: stateAtSubmit.startedAt,
        draft: stateAtSubmit.draft,
        final: stateAtSubmit.current,
        result: resultAtSubmit,
        score: resultAtSubmit.score,
        catch_rate: resultAtSubmit.catchRate,
      });
      if (left || playState !== stateAtSubmit) return;
      stateAtSubmit.submitted = true;
      stateAtSubmit.sessionId = created.id;
      helpMessage = created.help_stage_message;
      save();
      // Refreshes profileStore's help_stage so the next play session uses it.
      await loadProfile(profile.id);
    } catch (e) {
      if (left || playState !== stateAtSubmit) return;
      submitError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      submitting = false;
    }
  }

  async function ensureResults() {
    computeResult();
    if (playState && !playState.submitted) await submitSession();
  }

  function credits(t: TextFull): string {
    if (t.credits) return t.credits;
    if (t.source === 'custom' && t.added_by_name) return `Ajouté par ${t.added_by_name}`;
    return '';
  }
</script>

{#if !playState || showResumeBanner || (playState.phase !== 'dictation' && playState.phase !== 'proofreading')}
  <TopBar {profile} title={text?.title ?? ''} />
{/if}

{#if loading}
  <div class="screen"><p class="muted">Les Muses préparent le parchemin…</p></div>
{:else if error}
  <div class="screen"><p class="orange">Impossible de charger ce parchemin : {error}</p></div>
{:else if text && plan && playState}
  {#if showResumeBanner}
    <div class="screen">
      <h1>{text.title}</h1>
      <div class="banner">
        <p>Tu reprends là où tu t’étais arrêtée.</p>
        <div class="banner-actions">
          <button type="button" class="btn btn-primary" onclick={continueSession}>Continuer</button>
          <button type="button" class="btn" onclick={restart}>Recommencer</button>
        </div>
      </div>
    </div>
  {:else if playState.phase === 'intro'}
    <div class="screen">
      <h1>{text.title}</h1>
      {#if credits(text)}<p class="credits muted">{credits(text)}</p>{/if}
      <div class="chips">
        <span class="chip">{text.level}</span>
        <span class="chip">≈ {text.word_count} mots</span>
      </div>

      {#if !ttsAvailable()}
        <p class="orange">
          Cet appareil ne sait pas lire à voix haute. La dictée avancera toute seule, sans son.
        </p>
      {/if}

      <h2>Choisis ton rythme</h2>
      <PaceSelect bind:pace={playState.pace} />
      <p class="muted">Les récompenses augmentent avec le rythme.</p>

      <button type="button" class="btn btn-primary" onclick={startDictation}>
        Commencer la dictée
      </button>
    </div>
  {:else if playState.phase === 'dictation'}
    <Dictation
      {plan}
      pace={playState.pace}
      {voice}
      bind:text={playState.draft}
      onFinish={onDictationFinish}
      onQuit={quitDictation}
    />
  {:else if playState.phase === 'proofreading'}
    <Proofreading
      reference={text}
      bind:state={playState}
      {helpStage}
      argusOrder={stats?.argus_order ?? []}
      trapWords={trapWords.map((t) => t.word)}
      level={profile.level}
      onDone={onProofreadingDone}
    />
  {:else if result}
    <Results
      reference={text}
      {result}
      finalText={playState.current}
      {helpMessage}
      {submitError}
      {submitting}
      level={profile.level}
      onReplay={restart}
      onLibrary={toLibrary}
      onRetry={submitSession}
    />
  {:else}
    <div class="screen"><p class="muted">Les Muses comptent les pièges déjoués…</p></div>
  {/if}
{/if}

<style>
  .chips {
    display: flex;
    gap: 8px;
    margin: 12px 0 20px;
  }
  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    background: var(--aegean-light);
    border: 1px solid var(--aegean);
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-bottom: 20px;
  }
  .banner p {
    margin: 0;
  }
  .banner-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  h2 {
    margin-top: 24px;
  }
</style>
