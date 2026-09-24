// Client-side snapshot of an in-progress dictation session, kept in
// localStorage so a reload (or the iPad backgrounding Safari) doesn't lose
// her progress. Server-authoritative once submitted (Task 12); this is
// purely a resume aid. All storage access wrapped in try/catch (private
// mode, quota errors).
import type { Pace } from './dictation/script';

const VERSION = 1;

export type Phase = 'intro' | 'dictation' | 'proofreading' | 'results';

export interface PlayState {
  version: 1;
  profileId: number;
  textId: number;
  phase: Phase;
  pace: Pace;
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
}

export function playKey(profileId: number, textId: number): string {
  return `discorde.play.${profileId}.${textId}`;
}

export function loadPlayState(profileId: number, textId: number): PlayState | null {
  try {
    const raw = localStorage.getItem(playKey(profileId, textId));
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
    localStorage.setItem(playKey(s.profileId, s.textId), JSON.stringify(s));
  } catch {
    // Storage unavailable (private mode, quota) - non-fatal, resume just won't work.
  }
}

export function clearPlayState(profileId: number, textId: number): void {
  try {
    localStorage.removeItem(playKey(profileId, textId));
  } catch {
    // Storage unavailable - non-fatal.
  }
}

export function newPlayState(profileId: number, textId: number, pace: Pace): PlayState {
  return {
    version: VERSION,
    profileId,
    textId,
    phase: 'intro',
    pace,
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
