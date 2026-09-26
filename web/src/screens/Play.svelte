<script lang="ts">
  // The battle (UI4): one Play instance drives the muster, the dictation, the proofreading and the
  // victory on one battle stage (Ruling C1: a phase change, or the « Revoir » panel, never remounts
  // it). The phases are components of their own with full prop contracts, so the lanes restyling
  // them never edit this controller (Ruling C13).
  import { untrack } from 'svelte';
  import BattleStage from '../components/battle/BattleStage.svelte';
  import MusterPhase from '../components/battle/MusterPhase.svelte';
  import DictationPhase from '../components/battle/DictationPhase.svelte';
  import ProofPhase from '../components/battle/ProofPhase.svelte';
  import VictoryPhase from '../components/battle/VictoryPhase.svelte';
  import ReviewScroll from '../components/battle/ReviewScroll.svelte';
  import { api, ApiError } from '../lib/api';
  import { battleFor, isOpponentId, opponentFor, type BattlePhase, type OpponentId } from '../lib/battle/battle';
  import { hpDuringPlay } from '../lib/battle/hp';
  import { musterTaunt, STAGE } from '../lib/battle/lines';
  import { resetBattleStage, setHp } from '../lib/battle/stage.svelte';
  import { debounce } from '../lib/debounce';
  import { buildPlan, defaultPace, type DictationPlan } from '../lib/dictation/script';
  import { pickVoice, unlockSpeech, waitForVoices } from '../lib/dictation/tts';
  import { gradeSession } from '../lib/grading/grade';
  import type { Annotation, SessionResult } from '../lib/grading/types';
  import { initSound } from '../lib/juice/soundStore.svelte';
  import { clearPlayState, loadPlayState, newPlayState, savePlayState, type PlayState } from '../lib/playState';
  import { loadProfile } from '../lib/profileStore.svelte';
  import { closePanel, go, openPanel } from '../lib/scene/panelNav';
  import { href } from '../lib/routes';
  import { withDerivedCategories } from '../lib/world/derived';
  import { bandFor } from '../lib/world/eris';
  import { campFor, loadCatalog, refreshCamp } from '../lib/world/campStore.svelte';
  import { clockStart, clockStop, clockTick } from '../lib/world/playClock.svelte';
  import { erisSays } from '../lib/world/voices';
  import type { PlayMode, Profile, StatsResponse, TextFull, TrapWord } from '../lib/types';

  let {
    profile,
    textId,
    mode = 'dictation',
    query = {},
  }: { profile: Profile; textId: string; mode?: PlayMode; query?: Record<string, string> } = $props();

  const id = $derived(Number(textId));
  // This hero's camp snapshot only (final review I2): the store is shared across heroes.
  const camp = $derived(campFor(profile.id));
  // Quest-aware Play (SP3 Task 7): `quest`/`encounter` come from a QuestCard/lieutenant/boss link
  // (`?quest=...&encounter=...`); `help` overrides the profile's adaptive help stage for a single
  // session (boss fights force it a stage down, never up the aids).
  const questId = $derived(query.quest ? Number(query.quest) : null);
  const encounter = $derived(query.encounter ?? null);
  // An encounter that names an opponent decides the battle, whatever was saved (fix round 1 #1).
  const pinned = $derived<OpponentId | null>(encounter && isOpponentId(encounter) ? encounter : null);
  const helpOverride = $derived(query.help ? Number(query.help) : null);
  const helpStage = $derived(Math.min(4, Math.max(1, Math.round(helpOverride ?? profile.help_stage))) as 1 | 2 | 3 | 4);
  // Grimoire corrompu has no pace selector (plan decision #8: session.pace_level is always 1).
  const initialPace = $derived(mode === 'grimoire' ? 1 : defaultPace(profile.level));
  // A boss fight never slows down below the profile's own default pace (Decision 8: fewer aids,
  // never an easier one) - lower pace options stay visible but disabled (PaceMedallions' `minPace`).
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
  // The victory's spoils (VictorySpoils: XP, quests, dragon growth...) play once on the victory
  // sheet, then fold away; `restart()` (replay) needs a fresh one.
  let revealDone = $state(false);
  // Set once the player has explicitly left this session (toLibrary/clearPlayState): guards a
  // still-in-flight submitSession() from resurrecting the play state into localStorage after
  // it was deliberately cleared. Unlike a replay (which swaps `playState` for a fresh object,
  // already caught by the identity check below), toLibrary() clears storage but keeps the same
  // `playState` reference, so it needs its own flag.
  let left = false;
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

      // The saved state's key ignores the encounter (fix round 1 #1): an intro keeps nothing (not even
      // an opponent), and a battle saved against another opponent than this encounter's is not this
      // battle, so a fresh one starts. Under its own encounter, or none, a saved battle resumes.
      const saved = loadPlayState(profile.id, id, mode);
      const otherBattle = !!saved && pinned !== null && saved.opponent !== undefined && saved.opponent !== pinned;
      if (saved && saved.phase !== 'intro' && !otherBattle) {
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
    const opponent = playState?.opponent;
    clearPlayState(profile.id, id, mode);
    playState = newPlayState(profile.id, id, initialPace, mode);
    // A replay is the same battle: the same opponent, fresh combatants and a full hold.
    if (opponent) playState.opponent = opponent;
    resetBattleStage();
    showResumeBanner = false;
    result = null;
    helpMessage = null;
    submitError = null;
    corruptError = null;
    revealDone = false;
    left = false;
  }

  function toLibrary() {
    left = true;
    clearPlayState(profile.id, id, mode);
    go(href('library', { profileId: String(profile.id) }));
  }

  // "Pause" on the break nudge (spec §3.6, decision 16): back to the camp rather than the library,
  // since the camp is home now.
  function toLibraryCamp() {
    left = true;
    clearPlayState(profile.id, id, mode);
    go(href('camp', { profileId: String(profile.id) }));
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
  // phase (whose own DictationPhase.svelte onMount starts the runner with no
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

  // UI4 Ruling C15: « Quitter » on the proofreading, quitDictation's twin (the play state is saved
  // on every edit already). Wired now; Task 5 renders the button.
  function quitProofreading() {
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
      // Refreshes profileStore's help_stage so the next play session uses it, and campStore so
      // the dragon/XP/quests the victory's spoils read (and the camp screen on return) are
      // fresh with this session's progression already applied server-side.
      await Promise.all([loadProfile(profile.id), refreshCamp(profile.id)]);
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

  // Lieutenant key -> French name for the spoils' quest/neutralised titles (VictorySpoils);
  // 'eris' is added for the boss quest title, which the camp's lieutenant list doesn't carry.
  const progressionNames = $derived.by(() => {
    const out: Record<string, string> = { eris: 'Éris' };
    for (const l of camp?.lieutenants ?? []) out[l.key] = l.name;
    return out;
  });

  // UI4 Task 2: the stage needs the camp (the dragon, the HUD, a free text's lieutenant) and the
  // hero's mute setting, like every place (PlaceScene does the same, final review I2: the profile id
  // is the one dependency).
  let campTried = $state(false);
  $effect(() => {
    const pid = profile.id;
    untrack(() => {
      initSound(profile);
      void loadCatalog();
      void refreshCamp(pid).finally(() => (campTried = true));
    });
  });

  // Ruling C2: the opponent is chosen once, then kept in the play state (saved with it from the
  // dictation on) so a reload or a resume faces the same one. An explicit encounter, or Éris's own
  // grimoire, needs no camp. A free text waits for this visit's /camp answer (fix round 1 #3): a
  // cached snapshot may predate a lieutenant's waking or neutralisation.
  $effect(() => {
    if (!playState || playState.opponent) return;
    if (!pinned && mode !== 'grimoire' && !campTried) return;
    playState.opponent = opponentFor({
      mode,
      encounter,
      textId: id,
      lieutenants: camp?.lieutenants ?? [],
    });
    if (playState.phase !== 'intro') save();
  });
  const battle = $derived(playState?.opponent ? battleFor(playState.opponent, { mode, encounter }) : null);

  const phase = $derived<BattlePhase>(
    !playState || loading || error || showResumeBanner || playState.phase === 'intro'
      ? 'muster'
      : playState.phase === 'results'
        ? 'victory'
        : playState.phase,
  );

  // Ruling C3 (the user's decision): the hold is full while she plays, notched by the stage-3
  // count; it drops only at the reckoning (the victory phase, Task 6).
  $effect(() => {
    if (phase === 'dictation' || phase === 'proofreading' || phase === 'muster') {
      setHp(hpDuringPlay(helpStage, playState?.initialErrors));
    }
  });

  // Ruling C7: Éris's line at the muster.
  const taunt = $derived.by(() => {
    if (!battle) return null;
    const lt = camp?.lieutenants.find((l) => l.key === battle.opponent.id);
    return erisSays(musterTaunt({ opponent: battle.opponent.id, band: lt ? bandFor(lt) : null, mode }));
  });

  // Ruling C1: « Revoir » is ?panel=revoir on this very URL.
  const routeName = $derived(mode === 'grimoire' ? 'grimoire' : 'play');
  const params = $derived({ profileId: String(profile.id), textId: String(id) });
  const baseQuery = $derived(Object.fromEntries(Object.entries(query).filter(([k]) => k !== 'panel')));
  const reviewOpen = $derived(query.panel === 'revoir');
  function openReview() {
    openPanel(href(routeName, params, { ...baseQuery, panel: 'revoir' }));
  }
  function closeReview() {
    closePanel(href(routeName, params, Object.keys(baseQuery).length ? baseQuery : undefined));
  }
</script>

<BattleStage
  {battle}
  {phase}
  {profile}
  {camp}
  {mode}
  dragon={camp?.dragon ?? null}
  hud={phase === 'muster' || phase === 'victory'}
  exit={phase === 'muster' || phase === 'victory'}
>
  {#snippet children(layout)}
    {#if loading}
      <p class="kit-ribbon battle-status" data-testid="battle-status">{STAGE.loading}</p>
    {:else if error}
      <p class="kit-ribbon battle-status" data-testid="battle-status" role="alert">{STAGE.loadError(error)}</p>
    {:else if text && plan && playState}
      {#if showResumeBanner || playState.phase === 'intro'}
        <MusterPhase
          {text}
          {mode}
          bind:playState
          {minPace}
          {questId}
          {encounter}
          resume={showResumeBanner}
          {corrupting}
          {corruptError}
          {taunt}
          profileId={profile.id}
          onContinue={continueSession}
          onRestart={restart}
          onStart={startDictation}
          onOpenGrimoire={openGrimoire}
          onToLibrary={toLibrary}
        />
      {:else if playState.phase === 'dictation'}
        <DictationPhase
          {plan}
          pace={playState.pace}
          {voice}
          {layout}
          bind:text={playState.draft}
          onFinish={onDictationFinish}
          onQuit={quitDictation}
        />
      {:else if playState.phase === 'proofreading'}
        <ProofPhase
          reference={text}
          bind:state={playState}
          {helpStage}
          argusOrder={stats?.argus_order ?? []}
          trapWords={trapWords.map((t) => t.word)}
          level={profile.level}
          {mode}
          {layout}
          onDone={onProofreadingDone}
          onQuit={quitProofreading}
        />
      {:else}
        <VictoryPhase
          {result}
          {playState}
          {profile}
          {camp}
          {mode}
          opponent={playState.opponent ?? 'eris'}
          {encounter}
          {helpMessage}
          {submitError}
          {submitting}
          bind:revealDone
          names={progressionNames}
          onReplay={restart}
          onCamp={toLibraryCamp}
          onRetry={submitSession}
          onReview={openReview}
        />
      {/if}
    {/if}
  {/snippet}
  {#snippet overlay()}
    <!-- Outside the stage's inert <main> (BattleStage's `overlay`), so the scroll takes focus, Tab
         and taps like every place's overlay. -->
    {#if reviewOpen && phase === 'victory' && text && playState && result}
      <ReviewScroll reference={text} {result} finalText={playState.current} level={profile.level} onClose={closeReview} />
    {/if}
  {/snippet}
</BattleStage>

<style>
  .battle-status {
    display: block;
    width: fit-content;
    margin: auto;
    text-align: center;
  }
</style>
