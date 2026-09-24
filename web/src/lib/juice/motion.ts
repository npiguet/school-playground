// Reduced-motion detection (spec accessibility rule + decision 18): every
// animated component checks this before spawning particles or staggering
// reveals. `matchMedia` is undefined in SSR/node test environments, so this
// is guarded rather than assumed.
export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
