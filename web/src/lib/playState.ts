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

export function newPlayState(profileId: number, textId: number, pace: Pace, mode: PlayMode = 'dictation'): PlayState {
  return {
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
