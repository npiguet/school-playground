// Seamless loops (Ruling E9): the AAC encoder puts 1024 samples of priming before the audio and some
// padding after it. A browser that honours the file's edit list drops them; one that does not keeps
// them, and a plain loop would click and gap at the seam. Task 3 records each loop's exact length.
export interface LoopMeta {
  samples: number;
  rate: number;
  priming: number;
}

/** [start, length] of the loop in the decoded buffer, in seconds. */
export function loopRegion(bufferSeconds: number, meta: LoopMeta | undefined): [number, number] {
  if (!meta) return [0, bufferSeconds];
  const length = meta.samples / meta.rate;
  if (bufferSeconds <= length + 0.005) return [0, Math.min(length, bufferSeconds)];
  const priming = meta.priming / meta.rate;
  return [priming, Math.min(length, bufferSeconds - priming)];
}
