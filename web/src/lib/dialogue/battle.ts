// Éris and the dragon in battle (Ruling E14). Never during the dictation or the proofreading: the
// muster, the retry and the victory only; "error caught" and "error missed" at the reckoning.
import { dossierLine, type Band } from '../world/eris';
import { erisSays } from '../world/voices';
import { frenchSpacing } from '../text/french';
import { VICTORY } from '../battle/lines';
import type { OpponentId } from '../battle/battle';
import type { DragonOut } from '../world/types';
import type { DialogueLine } from '../scene/types';
import type { PlayMode } from '../types';
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

export function explainIntro(word: string, dragon: DragonOut | null): DialogueLine {
  return sayKey('battle.explain', { vars: { word }, dragon });
}
