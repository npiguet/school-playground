// What the proofreading shows for the aids taken along (spec 2026-09-29 §3): an aid left at the camp is
// absent for the whole session, no button, no pass strip, no count. Pure; ProofPhase renders it.
import type { AidKey } from '../aids';

export interface ProofAids {
  /** Les yeux d'Argus: the pass strip, its spotlight (the rest dimmed) and the « passes left » confirm. */
  passes: boolean;
  /** Le fil d'Ariane. */
  fil: boolean;
  /** Le bouclier de Persée. */
  bouclier: boolean;
  /** La chouette d'Athéna: the hints left (0 when she stayed at the camp). */
  hintsLeft: number;
  chouette: boolean;
  /** Les jetons de Palamède: the frozen count (null when they stayed at the camp). */
  count: number | null;
}

export function proofAids(aids: readonly AidKey[], o: { hints: number; hintsUsed: number; initialErrors: number | undefined }): ProofAids {
  const has = (k: AidKey) => aids.includes(k);
  const hintsLeft = has('athena') ? Math.max(0, o.hints - o.hintsUsed) : 0;
  return {
    passes: has('argus'),
    fil: has('ariane'),
    bouclier: has('persee'),
    hintsLeft,
    chouette: hintsLeft > 0,
    count: has('palamede') ? (o.initialErrors ?? 0) : null,
  };
}
