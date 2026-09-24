// Reduced-motion detection (spec accessibility rule + decision 18): every
// animated component checks this before spawning particles or staggering
// reveals. `matchMedia` is undefined in SSR/node test environments, so this
// is guarded rather than assumed.
export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Calls `onChange` now with the current preference, then on every change; returns the
 *  unsubscribe function. Scene components use it so an OS toggle applies without a reload. */
export function watchReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof matchMedia !== 'function') {
    onChange(false);
    return () => {};
  }
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  onChange(mq.matches);
  const listener = (e: { matches: boolean }) => onChange(e.matches);
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}
