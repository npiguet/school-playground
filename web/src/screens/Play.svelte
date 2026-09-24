<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import PaceSelect from '../components/PaceSelect.svelte';
  import Dictation from '../components/Dictation.svelte';
  import Proofreading from '../components/Proofreading.svelte';
  import Results from '../components/Results.svelte';
  import BreakNudge from '../components/BreakNudge.svelte';
  import { api, ApiError } from '../lib/api';
  import { debounce } from '../lib/debounce';
  import { formatSwissDate, isProphecy } from '../lib/dates';
  import { buildPlan, defaultPace, type DictationPlan } from '../lib/dictation/script';
  import { pickVoice, ttsAvailable, unlockSpeech, waitForVoices } from '../lib/dictation/tts';
  import { gradeSession } from '../lib/grading/grade';
  import type { Annotation, SessionResult } from '../lib/grading/types';
  import { clearPlayState, loadPlayState, newPlayState, savePlayState, type PlayState } from '../lib/playState';
  import { loadProfile } from '../lib/profileStore.svelte';
  import { navigate } from '../lib/router.svelte';
  import { href } from '../lib/routes';
  import { withDerivedCategories } from '../lib/world/derived';
  import { campStore } from '../lib/world/campStore.svelte';
  import { clockReset, clockStart, clockStop, clockTick, playClock } from '../lib/world/playClock.svelte';
  import type { PlayMode, Profile, StatsResponse, TextFull, TrapWord } from '../lib/types';

  let {
    profile,
    textId,
    mode = 'dictation',
    query = {},
  }: { profile: Profile; textId: string; mode?: PlayMode; query?: Record<string, string> } = $props();

  const id = $derived(Number(textId));
  // Quest-aware Play (SP3 Task 7): `quest`/`encounter` come from a QuestCard/lieutenant/boss link
  // (`?quest=...&encounter=...`); `help` overrides the profile's adaptive help stage for a single
  // session (boss fights force it a stage down, never up the aids).
  const questId = $derived(query.quest ? Number(query.quest) : null);
  const encounter = $derived(query.encounter ?? null);
  const helpOverride = $derived(query.help ? Number(query.help) : null);
  const helpStage = $derived(Math.min(4, Math.max(1, Math.round(helpOverride ?? profile.help_stage))) as 1 | 2 | 3 | 4);
  // Grimoire corrompu has no pace selector (plan decision #8: session.pace_level is always 1).
  const initialPace = $derived(mode === 'grimoire' ? 1 : defaultPace(profile.level));
  // A boss fight never slows down below the profile's own default pace (Decision 8: fewer aids,
  // never an easier one) - lower pace options stay visible but disabled (PaceSelect's `minPace`).
  const minPace = $derived(encounter === 'eris' ? defaultPace(profile.level) : 1);

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
  // Intro-only: never toggled during dictation/proofreading (the photo is the reference,
  // spec §3.2 - it must stay hidden while the child is writing).
  let showPhotos = $state(false);
  // Grimoire intro only: true while awaiting `api.texts.corrupt`; corruptError holds its detail
  // on failure (422 "not enough grip on this text" - spec §5, plan decision #8).
  let corrupting = $state(false);
  let corruptError = $state<string | null>(null);

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

      const saved = loadPlayState(profile.id, id, mode);
      if (saved) {
        playState = saved;
        showResumeBanner = saved.phase !== 'results';
      } else {
        playState = newPlayState(profile.id, id, initialPace, mode);
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
    clearPlayState(profile.id, id, mode);
    playState = newPlayState(profile.id, id, initialPace, mode);
    showResumeBanner = false;
    result = null;
    helpMessage = null;
    submitError = null;
    corruptError = null;
    left = false;
  }

  function toLibrary() {
    left = true;
    clearPlayState(profile.id, id, mode);
    navigate(href('library', { profileId: String(profile.id) }));
  }

  // "Pause" on the break nudge (spec §3.6, decision 16): back to the camp rather than the library,
  // since the camp is home now.
  function toLibraryCamp() {
    left = true;
    clearPlayState(profile.id, id, mode);
    navigate(href('camp', { profileId: String(profile.id) }));
  }

  // Active play time (dictation + proofreading only) drives the ~25-minute break nudge. Ticking
  // every 15s is frequent enough to notice 25 minutes promptly without hammering sessionStorage.
  $effect(() => {
    const phase = playState?.phase;
    if (phase === 'dictation' || phase === 'proofreading') {
      clockStart();
      const intervalId = setInterval(() => clockTick(), 15_000);
      return () => {
        clearInterval(intervalId);
        clockStop();
      };
    }
    clockStop();
  });

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

  // Grimoire intro's "Ouvrir le grimoire" button: Éris has already corrupted the text server-side
  // (spec §5, plan decision #8) - no dictation step, straight to proofreading the corrupted draft.
  async function openGrimoire() {
    if (!playState) return;
    corrupting = true;
    corruptError = null;
    try {
      const { corrupted, plants } = await api.texts.corrupt(id, { profile_id: profile.id, focus: query.focus });
      playState.draft = corrupted;
      playState.current = corrupted;
      playState.plants = plants;
      playState.phase = 'proofreading';
      playState.startedAt = new Date().toISOString();
      save();
    } catch (e) {
      corruptError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      corrupting = false;
    }
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
    result = withDerivedCategories(
      gradeSession(text.body, playState.draft, playState.current, text.annotation as Annotation, {
        paceLevel: playState.pace,
      }),
      text.body,
      playState.draft,
      text.annotation as Annotation,
    );
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
        pace_level: mode === 'grimoire' ? 1 : stateAtSubmit.pace,
        help_stage: helpStage,
        mode,
        started_at: stateAtSubmit.startedAt,
        draft: stateAtSubmit.draft,
        final: stateAtSubmit.current,
        result: resultAtSubmit,
        score: resultAtSubmit.score,
        catch_rate: resultAtSubmit.catchRate,
        encounter,
        quest_id: questId,
      });
      if (left || playState !== stateAtSubmit) return;
      stateAtSubmit.submitted = true;
      stateAtSubmit.sessionId = created.id;
      stateAtSubmit.progression = created.progression;
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
      <h1>{mode === 'grimoire' ? 'Grimoire corrompu' : text.title}</h1>
      {#if credits(text)}<p class="credits muted">{credits(text)}</p>{/if}
      <div class="chips">
        <span class="chip">{text.level}</span>
        <span class="chip">≈ {text.word_count} mots</span>
      </div>

      {#if text.due_date && isProphecy(text.due_date)}
        <p class="prophecy" data-testid="play-prophecy">
          Dictée préparée pour le {formatSwissDate(text.due_date)} — la prophétie de l'Oracle.
        </p>
      {/if}

      {#if questId}
        <div class="parchment quest-banner" data-testid="play-quest-banner">
          <p>Ce texte compte pour ta quête.</p>
        </div>
      {/if}

      {#if encounter === 'eris'}
        <div class="eris-panel boss-banner" data-testid="play-boss-banner">
          <p>Combat contre Éris — les Yeux d'Argus restent éteints.</p>
        </div>
      {/if}

      {#if text.photo_count > 0}
        <button type="button" class="btn photos-toggle" onclick={() => (showPhotos = !showPhotos)}>
          {showPhotos ? 'Cacher la feuille' : 'Voir la feuille'}
        </button>
        {#if showPhotos}
          <div class="scan-photos">
            {#each Array.from({ length: text.photo_count }, (_, i) => i + 1) as n (n)}
              <img
                src={api.scan.pageUrl(text.scan_id ?? '', n)}
                alt={`Page ${n} de la feuille scannée`}
                class="scan-photo"
              />
            {/each}
          </div>
        {/if}
      {/if}

      {#if mode === 'grimoire'}
        <p>Éris a recopié ce parchemin en y semant ses dés-accords. Pas de dictée cette fois : retrouve-les et répare-les.</p>

        {#if corruptError}
          <p class="orange">{corruptError}</p>
          <button type="button" class="btn" data-testid="btn-back-library" onclick={toLibrary}>Retour aux Parchemins</button>
        {:else if corrupting}
          <p class="muted">Éris corrompt le grimoire…</p>
        {:else}
          <button type="button" class="btn btn-primary" data-testid="btn-open-grimoire" onclick={openGrimoire}>
            Ouvrir le grimoire
          </button>
        {/if}
      {:else}
        {#if !ttsAvailable()}
          <p class="orange">
            Cet appareil ne sait pas lire à voix haute. La dictée avancera toute seule, sans son.
          </p>
        {/if}

        <h2>Choisis ton rythme</h2>
        <PaceSelect bind:pace={playState.pace} {minPace} />
        <p class="muted">Les récompenses augmentent avec le rythme.</p>

        <button type="button" class="btn btn-primary" onclick={startDictation}>
          Commencer la dictée
        </button>

        <button
          type="button"
          class="btn"
          data-testid="btn-grimoire"
          onclick={() => navigate(href('grimoire', { profileId: String(profile.id), textId: String(id) }))}
        >
          Grimoire corrompu
        </button>
        <p class="muted">
          Éris a déjà recopié ce texte… avec ses dés-accords. Pas de dictée : relis et répare.
        </p>
      {/if}
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
      {mode}
      onDone={onProofreadingDone}
    />
  {:else if result}
    {#if playClock.needsBreak}
      <BreakNudge
        dragonName={campStore.data?.dragon.name ?? 'Ton dragon'}
        onPause={toLibraryCamp}
        onContinue={() => clockReset()}
      />
    {/if}
    <Results
      reference={text}
      {result}
      finalText={playState.current}
      {helpMessage}
      {submitError}
      {submitting}
      level={profile.level}
      {mode}
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
  .prophecy {
    color: var(--gold);
    font-weight: 600;
    margin: 0 0 16px;
  }
  .quest-banner,
  .boss-banner {
    padding: 12px 16px;
    margin: 0 0 16px;
  }
  .quest-banner p,
  .boss-banner p {
    margin: 0;
    font-weight: 600;
  }
  .photos-toggle {
    margin-bottom: 16px;
  }
  .scan-photos {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }
  .scan-photo {
    width: 100%;
    object-fit: contain;
    max-height: 70vh;
    border-radius: var(--radius);
    border: 1px solid var(--marble-dark);
    background: #fff;
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
