// A trailing-edge debounce: `fn` runs `ms` after the last call, cancelling any call still
// pending from an earlier one. Used to persist state (e.g. the dictation draft, P1-3) without
// writing to storage on every keystroke. `cancel()` drops the pending call (the caller has just
// saved by itself, or what was pending is no longer wanted).
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): ((...args: Args) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: Args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  return Object.assign(debounced, { cancel: () => clearTimeout(timer) });
}
