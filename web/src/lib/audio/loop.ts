// Seamless loops (Ruling E9): the AAC encoder puts 1024 samples of priming before the audio and some
// padding after it. A browser that honours the file's edit list drops them; one that does not keeps
// them, and a plain loop would click and gap at the seam. Task 3 records each loop's exact length.
export interface LoopMeta {
  samples: number;
  rate: number;
  priming: number;
}

/** [start, length] of the loop in the decoded buffer, in seconds. The priming was kept exactly when
 *  the buffer holds at least priming + audio: a buffer that kept only the tail padding (up to ~900
 *  samples in Task 3's files) still starts at 0 (lane A review #4). */
export function loopRegion(bufferSeconds: number, meta: LoopMeta | undefined): [number, number] {
  if (!meta) return [0, bufferSeconds];
  const length = meta.samples / meta.rate;
  const primingKept = bufferSeconds >= (meta.samples + meta.priming) / meta.rate - 1e-4;
  if (!primingKept) return [0, Math.min(length, bufferSeconds)];
  const priming = meta.priming / meta.rate;
  return [priming, Math.min(length, bufferSeconds - priming)];
}
