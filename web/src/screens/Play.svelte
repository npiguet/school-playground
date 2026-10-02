<script lang="ts">
  // The battle (UI4): one Play instance drives the muster, the dictation, the proofreading and the
  // victory on one battle stage (Ruling C1: a phase change, or the « Revoir » panel, never remounts
  // it). The phases are components of their own with full prop contracts, so the lanes restyling
  // them never edit this controller (Ruling C13).
  import { tick, untrack } from 'svelte';
  import BattleStage from '../components/battle/BattleStage.svelte';
  import MusterPhase from '../components/battle/MusterPhase.svelte';
  import DictationPhase from '../components/battle/DictationPhase.svelte';
  import ProofPhase from '../components/battle/ProofPhase.svelte';
  import VictoryPhase from '../components/battle/VictoryPhase.svelte';
  import ReviewScroll from '../components/battle/ReviewScroll.svelte';
  import { api, ApiError } from '../lib/api';
  import { battleFor, isOpponentId, opponentFor, type BattlePhase, type OpponentId } from '../lib/battle/battle';
  import { emitBattle } from '../lib/battle/events';
  import { battleOriginOf, quitTarget } from '../lib/battle/origin';
  import { hpDuringPlay } from '../lib/battle/hp';
  import { STAGE } from '../lib/battle/lines';
  import { musterLine } from '../lib/dialogue/battle';
  import { explainContext } from '../lib/explain';
  import type { DialogueLine } from '../lib/scene/types';
  import { resetBattleStage, setHp } from '../lib/battle/stage.svelte';
  import { debounce } from '../lib/debounce';
  import { buildPlan, defaultPace, type DictationPlan } from '../lib/dictation/script';
  import { gradeSession } from '../lib/grading/grade';
  import type { Annotation, SessionResult } from '../lib/grading/types';
  import { initAudioSettings } from '../lib/audio/store.svelte';
  import {
    battleContext,
    clearPlayState,
    loadPlayState,
    newPlayState,
    resumesUnder,
    savePlayState,
    type PlayState,
  } from '../lib/playState';
  import { loadProfile } from '../lib/profileStore.svelte';
  import { closePanel, go } from '../lib/scene/panelNav';
  import { replaceRoute } from '../lib/router.svelte';
  import { href } from '../lib/routes';
  import { withDerivedCategories } from '../lib/world/derived';
  import { bandFor } from '../lib/world/eris';
  import { campFor, campStore, loadCatalog, refreshCamp } from '../lib/world/campStore.svelte';
  import { normalizeAids } from '../lib/aids';
  import { proofAids } from '../lib/battle/proofAids';
  import { rulesOf } from '../lib/rules';
  import { clockStart, clockStop, clockTick } from '../lib/world/playClock.svelte';
  import { markTourSeen, shouldTour } from '../lib/tours/seen.svelte';
  import { seenVersion, tourSteps } from '../lib/tours/tours';
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
  // (`?quest=...&encounter=...`).
  const urlUnder = $derived({ encounter: query.encounter ?? null, quest: query.quest ? Number(query.quest) : null });
  let playState = $state<PlayState | null>(null);
  // Ruling C2c: the battle runs under the encounter and quest it was started with (saved in its play
  // state), not the URL's: a boss fight reopened from the shelves is still the boss fight, and a free
  // save never becomes one. Before the state exists, the URL's; its quest too.
  const under = $derived(battleContext(playState, urlUnder));
  const questId = $derived(under.quest);
  const encounter = $derived(under.encounter);
  // An encounter that names an opponent decides the battle, whatever was saved (fix round 1 #1).
  const pinned = $derived<OpponentId | null>(encounter && isOpponentId(encounter) ? encounter : null);
  // Spec 2026-09-29 §3: the aids this battle runs with. A fresh battle starts from the hero's remembered
  // choice (all five for a new hero); once it exists, the battle's own.
  const aids = $derived(playState?.aids ?? normalizeAids(profile.settings.aids));
  const rules = $derived(rulesOf(campStore.catalog));
  // Grimoire corrompu has no pace selector (plan decision #8: session.pace_level is always 1).
  const initialPace = $derived(mode === 'grimoire' ? 1 : defaultPace(profile.level));
  // A boss fight never slows down below the profile's own default pace (Decision 8: fewer aids,
  // never an easier one) - lower pace options stay visible but disabled (PaceMedallions' `minPace`).
  const minPace = $derived(encounter === 'eris' ? defaultPace(profile.level) : 1);

  let text = $state<TextFull | null>(null);
  let trapWords = $state<TrapWord[]>([]);
  let stats = $state<StatsResponse | null>(null);
  let plan = $state<DictationPlan | null>(null);
  let showResumeBanner = $state(false);
  let loading = $state(true);
  let error = $state('');
  let result = $state<SessionResult | null>(null);
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
  // « Rejouer ce texte » was tapped: the muster says Éris's retry line.
  let retried = $state(false);

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

      // The saved state's key ignores the encounter (Ruling C2c): an intro keeps nothing (not even an
      // opponent), and a battle started under another encounter than this link's is not this battle,
      // so a fresh one starts for the link's. A link with no encounter reopens the saved battle, under
      // its own encounter and quest.
      const saved = loadPlayState(profile.id, id, mode);
      if (saved && resumesUnder(saved, urlUnder.encounter)) {
        playState = saved;
        showResumeBanner = saved.phase !== 'results';
      } else {
        playState = newPlayState(profile.id, id, initialPace, mode, urlUnder, normalizeAids(profile.settings.aids));
      }
      if (playState.phase === 'results') void ensureResults();
      // M3: « Revoir » lives in the victory only; a deep link to it elsewhere drops the panel.
      if (reviewOpen && playState.phase !== 'results') replaceRoute(baseHref);
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
    void playState.dictationStep; // and on every new unit read (Ruling M20)
    void playState.dictationReplaysLeft; // and on every replay spent (closing item 1)
    saveDraftDebounced();
  });

  function restart() {
    // A draft save still pending must not bring the old attempt back.
    saveDraftDebounced.cancel();
    const opponent = playState?.opponent;
    clearPlayState(profile.id, id, mode);
    // A replay is the same battle: the same opponent and encounter, fresh combatants, a full hold.
    playState = newPlayState(profile.id, id, initialPace, mode, under, aids);
    if (opponent) playState.opponent = opponent;
    resetBattleStage();
    emitBattle({ kind: 'retry' });
    // Her retry line at the next muster (Ruling E14). A different battle is a new Play (App keys it
    // on the battle), so this starts false for each one.
    retried = true;
    showResumeBanner = false;
    result = null;
    submitError = null;
    corruptError = null;
    revealDone = false;
    left = false;
    void focusMuster();
  }

  // The button that started a restart (the ribbon's, the quit confirm's, the victory's) is gone with
  // its phase: the focus goes on to the new muster's start, unless its tour is speaking (R11: the
  // tour's plate leads, then hands the focus on itself). Without scrolling: a narrow muster scrolls,
  // and Éris's line at its top is the first thing to read.
  async function focusMuster() {
    await tick();
    if (musterTour) return;
    document.querySelector<HTMLElement>('[data-testid="btn-start"], [data-testid="btn-open-grimoire"]')?.focus({ preventScroll: true });
  }

  /** The player leaves this battle for good: nothing of it is kept (a victory's saved results would
   *  otherwise greet her the next time she opens the text), and a submission still in flight must not
   *  save it again (`left`). */
  function leaveBattle() {
    left = true;
    clearPlayState(profile.id, id, mode);
    emitBattle({ kind: 'leave' });
  }

  function toLibrary() {
    leaveBattle();
    go(href('library', { profileId: String(profile.id) }));
  }

  // "Pause" on the break nudge (spec §3.6, decision 16): back to the camp rather than the library,
  // since the camp is home now.
  function toLibraryCamp() {
    leaveBattle();
    go(href('camp', { profileId: String(profile.id) }));
  }

  // The scene exit « Le camp » (M2): from the victory it leaves the battle as « Retour au camp »
  // does; from the muster a saved dictation or proofreading stays behind its resume ribbon.
  function onExit() {
    if (phase === 'victory') leaveBattle();
    else emitBattle({ kind: 'leave' });
  }

  // Active play time (dictation + proofreading only) drives the ~25-minute break nudge. Ticking
  // every 15s is frequent enough to notice 25 minutes promptly without hammering sessionStorage.
  // Keyed on the battle's phase, not the saved one (M1): behind the resume ribbon a saved dictation
  // is on the muster, and the clock rests.
  $effect(() => {
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

  // Tapped from the resume banner. The tap itself unlocks the audio (lib/audio/gestures.ts), the voice
  // included.
  function continueSession() {
    showResumeBanner = false;
  }

  // The tap on « Commencer la dictée » unlocks the audio (lib/audio/gestures.ts): the voice plays through it.
  // It ends the muster's tour too (R11: the tour is never a modal in the way).
  function startDictation() {
    endMusterTour();
    if (!playState) return;
    playState.startedAt = new Date().toISOString();
    playState.phase = 'dictation';
    save();
  }

  // The user's report 2026-10-02: « Oui, quitter » (the dictation's or the proofreading's) leaves the
  // battle, saved as it stands (the draft's pending save flushed now), for the place it was opened
  // from (lib/battle/origin.ts). Opening the text again later shows the resume ribbon, as a page load
  // with a saved state does. The voice is already stopped (DictationPhase's confirm).
  function saveAndLeave() {
    saveDraftDebounced.cancel();
    save();
    emitBattle({ kind: 'leave' });
  }

  function quitBattle() {
    saveAndLeave();
    go(quitTarget(battleOriginOf(history.state), profile.id));
  }

  // Spec 2026-09-27 §5.3: Éris's card's way back to the camp leaves as « Quitter » does (the draft kept
  // behind the resume ribbon), but always for the camp, as it says.
  function leaveDictationForCamp() {
    saveAndLeave();
    go(href('camp', { profileId: String(profile.id) }));
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
      gradeSession(text.body, playState.draft, playState.current, text.annotation as Annotation),
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
        aids: stateAtSubmit.aids,
        mode,
        started_at: stateAtSubmit.startedAt,
        draft: stateAtSubmit.draft,
        final: stateAtSubmit.current,
        result: resultAtSubmit,
        catch_rate: resultAtSubmit.catchRate,
        encounter,
        quest_id: questId,
      });
      if (left || playState !== stateAtSubmit) return;
      stateAtSubmit.submitted = true;
      stateAtSubmit.sessionId = created.id;
      stateAtSubmit.progression = created.progression;
      save();
      // Refreshes profileStore (the aids the server remembered for the next muster) and campStore so
      // the dragon/XP/quests the victory's spoils read (and the camp screen on return) are
      // fresh with this session's progression already applied server-side. The stats and the trap
      // words too (final review I2): « Rejouer ce texte » musters again without a new load(), and its
      // suggestion (recent_sessions), Argus's order and the trap words must include this session.
      // The session is saved by now: a failed refresh keeps the old history rather than turning into
      // a submission error (whose « Réessayer » would post the session twice).
      const [, , st, tw] = await Promise.all([
        loadProfile(profile.id).catch(() => null),
        refreshCamp(profile.id),
        api.profiles.stats(profile.id).catch(() => null),
        api.profiles.trapWords(profile.id).catch(() => null),
      ]);
      if (left) return;
      if (st) stats = st;
      if (tw) trapWords = tw;
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

  // Lieutenant key -> French name for the spoils' quest titles and seal cards (VictorySpoils);
  // 'eris' is added for the boss quest title, which the camp's lieutenant list doesn't carry.
  const progressionNames = $derived.by(() => {
    const out: Record<string, string> = { eris: 'Éris' };
    for (const l of camp?.lieutenants ?? []) out[l.key] = l.name;
    return out;
  });

  // UI4 Task 2: the stage needs the camp (the dragon, the HUD, a free text's lieutenant) and the
  // hero's mute setting, like every place. The profile id is the one dependency (M6): a derived id,
  // so a new profile object for the same hero (submitSession's loadProfile) fetches nothing again.
  let campTried = $state(false);
  const pid = $derived(profile.id);
  $effect(() => {
    const heroId = pid;
    untrack(() => {
      initAudioSettings(profile);
      void loadCatalog();
      void refreshCamp(heroId).finally(() => (campTried = true));
    });
  });

  // Ruling C2: the opponent is chosen once, then kept in the play state (saved with it from the
  // dictation on) so a reload or a resume faces the same one. An explicit encounter, or Éris's own
  // grimoire, needs no camp. A free text waits for this visit's /camp answer (fix round 1 #3): a
  // cached snapshot may predate a lieutenant's waking or seal.
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

  // Ruling C3 (the user's decision): the hold is full while she plays, notched by Palamède's count
  // when his tokens were taken along; it drops only at the reckoning (the victory phase, Task 6).
  $effect(() => {
    if (phase === 'dictation' || phase === 'proofreading' || phase === 'muster') {
      // The notches are the count the proofreading shows (one rule: proofAids).
      setHp(hpDuringPlay(proofAids(aids, { hints: 0, hintsUsed: 0, initialErrors: playState?.initialErrors }).count));
    }
  });

  // UI5 Ruling E14: Éris's muster line, from her lines (battle.start / battle.retry) or her dossier line
  // for a lieutenant. A line from her lines is picked once when the muster shows (a pick is
  // remembered: no immediate repeat), never in a $derived; the dossier line is no pick, and follows
  // the camp (its band) as it arrives.
  let taunt = $state<DialogueLine | null>(null);
  $effect(() => {
    if (phase !== 'muster' || !battle) {
      if (phase !== 'muster') taunt = null;
      return;
    }
    const opponent = battle.opponent.id;
    const picked = retried || opponent === 'eris';
    if (picked && untrack(() => taunt)) return;
    const lt = camp?.lieutenants.find((l) => l.key === opponent);
    untrack(() => {
      taunt = musterLine({ opponent, band: lt ? bandFor(lt) : null, mode, retry: retried });
    });
  });

  // Spec 2026-09-29 explanations §2 (R11): the muster's own tour, once, on the first dictation muster
  // (never a resume or the grimoire), once /camp has been asked (the dragon speaks in its own look).
  let musterTour = $state<{ lines: DialogueLine[]; targets: (string | null)[] } | null>(null);
  let musterTourAsked = false;
  $effect(() => {
    if (musterTourAsked || !campTried || phase !== 'muster' || mode !== 'dictation' || showResumeBanner || playState?.phase !== 'intro') return;
    musterTourAsked = true;
    untrack(() => {
      if (!shouldTour(profile, 'muster')) return;
      const steps = tourSteps('muster', camp?.dragon ?? null, seenVersion(profile.settings, 'muster'));
      if (steps.lines.length > 0) musterTour = steps;
      else void markTourSeen(profile, 'muster');
    });
  });
  function endMusterTour() {
    if (!musterTour) return;
    musterTour = null;
    void markTourSeen(profile, 'muster');
  }

  // UI5 Ruling E14: what the dragon's explanations read at the victory (« Revoir » reads the same).
  const explainCtx = $derived(text ? explainContext(text.body, text.annotation as Annotation, profile.level) : null);

  // Ruling C1: « Revoir » is ?panel=revoir on this very URL.
  const routeName = $derived(mode === 'grimoire' ? 'grimoire' : 'play');
  const params = $derived({ profileId: String(profile.id), textId: String(id) });
  const baseQuery = $derived(Object.fromEntries(Object.entries(query).filter(([k]) => k !== 'panel')));
  const reviewOpen = $derived(query.panel === 'revoir');
  const baseHref = $derived(href(routeName, params, Object.keys(baseQuery).length ? baseQuery : undefined));
  // Through `go` like every control that navigates (M4): the same tap feedback.
  function openReview() {
    go(href(routeName, params, { ...baseQuery, panel: 'revoir' }), 'panel');
  }
  function closeReview() {
    closePanel(baseHref);
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
  hug={phase === 'muster' && !loading && !error && (showResumeBanner || mode === 'grimoire')}
  {onExit}
>
  {#snippet children(layout, reduced)}
    {#if loading}
      <p class="kit-ribbon battle-status" data-testid="battle-status" role="status">{STAGE.loading}</p>
    {:else if error}
      <p class="kit-ribbon battle-status" data-testid="battle-status" role="alert">{STAGE.loadError(error)}</p>
    {:else if text && plan && playState}
      {#if showResumeBanner || playState.phase === 'intro'}
        <MusterPhase
          {text}
          {mode}
          bind:playState
          {minPace}
          {rules}
          recent={stats?.recent_sessions ?? []}
          {questId}
          {encounter}
          resume={showResumeBanner}
          {corrupting}
          {corruptError}
          {taunt}
          tour={musterTour}
          onTourDone={endMusterTour}
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
          profileId={profile.id}
          {layout}
          title={text.title}
          from={playState.dictationStep ?? 0}
          replaysLeft={playState.dictationReplaysLeft}
          bind:text={playState.draft}
          onFinish={onDictationFinish}
          onQuit={quitBattle}
          onRestart={restart}
          onLeaveToCamp={leaveDictationForCamp}
          onProgress={(step, replaysLeft) => {
            if (playState) {
              playState.dictationStep = step;
              playState.dictationReplaysLeft = replaysLeft;
            }
          }}
        />
      {:else if playState.phase === 'proofreading'}
        <ProofPhase
          reference={text}
          bind:state={playState}
          {aids}
          hints={rules.chouette_hints}
          argusOrder={stats?.argus_order ?? []}
          trapWords={trapWords.map((t) => t.word)}
          level={profile.level}
          {mode}
          {layout}
          onDone={onProofreadingDone}
          onQuit={quitBattle}
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
          {submitError}
          {submitting}
          bind:revealDone
          names={progressionNames}
          {explainCtx}
          {reduced}
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
