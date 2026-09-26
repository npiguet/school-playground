// Client-side snapshot of an in-progress dictation session, kept in
// localStorage so a reload (or the iPad backgrounding Safari) doesn't lose
// her progress. Server-authoritative once submitted (Task 12); this is
// purely a resume aid. All storage access wrapped in try/catch (private
// mode, quota errors).
import type { OpponentId } from './battle/battle';
import type { Pace } from './dictation/script';
import type { Plant, PlayMode } from './types';
import type { Progression } from './world/types';

const VERSION = 1;

export type Phase = 'intro' | 'dictation' | 'proofreading' | 'results';

export interface PlayState {
  version: 1;
  profileId: number;
  textId: number;
  phase: Phase;
  pace: Pace;
  /** SP2 Task 9: which flow this state belongs to; also decides the localStorage key (`playKey`)
   *  so a dictation and a grimoire session on the same text never overwrite each other. */
  mode: PlayMode;
  startedAt: string;
  draft: string;
  current: string;
  hintsUsed: number;
  revealedKeys: string[];
  passIndex: number;
  bouclier: boolean;
  submitted: boolean;
  sessionId: number | null;
  /** Draft error count frozen when proofreading starts (help stage 3 shows it; plan decision #6). */
  initialErrors?: number;
  /** Fil d'Ariane thread counters (SP2 Task 7), restored across a reload/resume; missing (older
   *  saved state, or never used) means `{0, 0}`. No version bump: an optional field. */
  fil?: { drawn: number; correct: number };
  /** The errors Éris planted (SP2 Task 9, grimoire mode only); set once by `corrupt` and kept for
   *  the life of the session. No version bump: an optional field, absent in dictation mode. */
  plants?: Plant[];
  /** SP3 Task 7: the progression `POST /api/sessions` returned (XP, quests, neutralisations,
   *  dragon stage, weekly goal, boss outcome) - stored so a reload can still render it (Task 8).
   *  No version bump: an optional field, absent until a session is actually submitted. */
  progression?: Progression;
  /** UI4 Ruling C2: the opponent chosen for this session (presentation only), kept so a reload or a
   *  resume faces the same one. No version bump: an optional field, absent until chosen. */
  opponent?: OpponentId;
  /** UI4 Ruling C2c: the encounter (`?encounter=`) this battle was started under, `null` for none.
   *  It decides the battle once saved: a boss fight reopened from the shelves stays the boss fight
   *  (its pace floor, its verdict, its submission). No version bump: absent in older saved states,
   *  which count as started under no encounter. */
  encounter?: string | null;
  /** UI4 Ruling C2c: the quest (`?quest=`) this battle was started under, `null` for none; submitted
   *  with the session. No version bump: an optional field. */
  quest?: number | null;
  /** UI4 Ruling C2d: the help stage the battle's link imposed (`?help=`, the boss link's), `null` for
   *  none (the profile's own stage). Kept with the encounter and quest, so a boss battle reopened from
   *  the shelves keeps the boss's help stage. No version bump: absent in older saved states, which
   *  keep taking the link's. */
  help?: number | null;
  /** UI4 Ruling M20: where the dictation's reading resumes, the script step of the unit (a sentence
   *  or a chunk) that was being read when it was saved. No version bump: absent means the start. */
  dictationStep?: number;
}

/** What a battle runs under (Rulings C2c, C2d): the encounter, the quest and the imposed help stage. */
export interface BattleUnder {
  encounter: string | null;
  quest: number | null;
  help?: number | null;
}

/** UI4 Ruling C2c: whether a saved battle is the one this URL opens. An intro keeps nothing. A link
 *  with no encounter (the shelves, a reload of a plain link) reopens whatever was saved, under the
 *  encounter it was started with; a link with an encounter reopens only a battle started under that
 *  same encounter, so a free or grimoire save never passes for the boss fight (or a lieutenant's
 *  quest), and the other way round. The opponent never decides: Éris is the opponent of the boss
 *  fight, of every grimoire and of a free text once no lieutenant is left. */
export function resumesUnder(saved: PlayState, encounter: string | null): boolean {
  if (saved.phase === 'intro') return false;
  return encounter === null || (saved.encounter ?? null) === encounter;
}

/** The encounter, quest and imposed help stage a battle runs under: the saved battle's own once it
 *  has one, else the URL's (a fresh battle records them, `newPlayState`'s `under`). An older save
 *  without a help field keeps the URL's, as before Ruling C2d. */
export function battleContext(state: PlayState | null, url: BattleUnder): Required<BattleUnder> {
  if (!state) return { encounter: url.encounter, quest: url.quest, help: url.help ?? null };
  return {
    encounter: state.encounter ?? null,
    quest: state.quest ?? null,
    help: state.help !== undefined ? state.help : (url.help ?? null),
  };
}

/** The localStorage key for a play session: distinct per mode so a dictation session and a
 *  grimoire session on the same text coexist instead of shadowing each other (SP2 Task 9). The
 *  dictation key is unchanged from SP1 so old saved sessions keep resolving. */
export function playKey(profileId: number, textId: number, mode: PlayMode = 'dictation'): string {
  const base = `discorde.play.${profileId}.${textId}`;
  return mode === 'grimoire' ? `${base}.grimoire` : base;
}

export function loadPlayState(profileId: number, textId: number, mode: PlayMode = 'dictation'): PlayState | null {
  try {
    const raw = localStorage.getItem(playKey(profileId, textId, mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== VERSION) return null;
    return parsed as PlayState;
  } catch {
    return null;
  }
}

export function savePlayState(s: PlayState): void {
  try {
    localStorage.setItem(playKey(s.profileId, s.textId, s.mode), JSON.stringify(s));
  } catch {
    // Storage unavailable (private mode, quota) - non-fatal, resume just won't work.
  }
}

export function clearPlayState(profileId: number, textId: number, mode: PlayMode = 'dictation'): void {
  try {
    localStorage.removeItem(playKey(profileId, textId, mode));
  } catch {
    // Storage unavailable - non-fatal.
  }
}

export function newPlayState(
  profileId: number,
  textId: number,
  pace: Pace,
  mode: PlayMode = 'dictation',
  under: BattleUnder = { encounter: null, quest: null },
): PlayState {
  return {
    encounter: under.encounter,
    quest: under.quest,
    help: under.help ?? null,
    version: VERSION,
    profileId,
    textId,
    phase: 'intro',
    pace,
    mode,
    startedAt: new Date().toISOString(),
    draft: '',
    current: '',
    hintsUsed: 0,
    revealedKeys: [],
    passIndex: 0,
    bouclier: false,
    submitted: false,
    sessionId: null,
  };
}
