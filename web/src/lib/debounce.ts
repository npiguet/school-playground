// A trailing-edge debounce: `fn` runs `ms` after the last call, cancelling any call still
// pending from an earlier one. Used to persist state (e.g. the dictation draft, P1-3) without
// writing to storage on every keystroke.
export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
