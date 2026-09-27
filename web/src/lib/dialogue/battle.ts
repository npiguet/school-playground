// Éris and the dragon in battle (Ruling E14). Never during the dictation or the proofreading: the
// muster, the retry and the victory only; "error caught" and "error missed" at the reckoning.
import { dossierLine, type Band } from '../world/eris';
import { erisSays } from '../world/voices';
import { frenchSpacing } from '../text/french';
import { VICTORY } from '../battle/lines';
import type { OpponentId } from '../battle/battle';
import type { DragonLook } from '../world/scenes/speakers';
import type { DialogueLine } from '../scene/types';
import type { PlayMode } from '../types';
import { statKey } from '../grading/grade';
import type { TokenError } from '../grading/types';
import { sayKey } from './select';
import type { DialogueKey } from './types';

export function erisVictoryKey(o: { draft: number; catchRate: number | null }): DialogueKey {
  if (o.draft === 0) return 'battle.perfect';
  const r = o.catchRate ?? 0;
  if (r >= 0.8) return 'battle.victory';
  if (r >= 0.5) return 'battle.retreat';
  if (r > 0) return 'battle.caught';
  return 'battle.missed';
}

export function erisVictoryLine(o: { draft: number; catchRate: number | null; introduced: number; mode: PlayMode }): DialogueLine {
  const line = sayKey(erisVictoryKey(o), { ctx: { mode: o.mode } });
  return o.introduced > 0 ? { ...line, text: `${line.text} ${frenchSpacing(VICTORY.erisIntroduced(o.introduced))}` } : line;
}

export function musterLine(o: { opponent: OpponentId; band: Band | null; mode: PlayMode; retry: boolean }): DialogueLine {
  if (o.retry) return sayKey('battle.retry', { ctx: { mode: o.mode, opponent: o.opponent } });
  if (o.opponent !== 'eris') return erisSays(dossierLine(o.opponent, o.band ?? 'none'));
  return sayKey('battle.start', { ctx: { mode: o.mode } });
}

export function explainIntro(word: string, dragon: DragonLook | null): DialogueLine {
  return sayKey('battle.explain', { vars: { word }, dragon });
}

/** Where a trap sits in the text: its reference word, or (a word in excess, which has none) just
 *  after the word it follows. */
const textOrder = (e: TokenError) => e.refIndex ?? e.anchor + 0.5;

/** The traps the dragon explains after the tally (Ruling E14): among `finalErrors` (the traps still
 *  standing in the final text, the words « Revoir » marks orange), the first of each category (the
 *  « Revoir » groups, statKey) in text order, at most `max`. */
export function stillStanding(finalErrors: TokenError[], max: number): TokenError[] {
  const seen = new Set<string>();
  const out: TokenError[] = [];
  for (const e of [...finalErrors].sort((a, b) => textOrder(a) - textOrder(b))) {
    if (out.length >= max) break;
    const k = statKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
