// The living dragon's tint (spec 2026-10-02 living dragon, "Tint"). TINT_FILTERS (world/dragon.ts) stay
// the single source: their CSS functions are turned into the Filter Effects 1 colour matrices
// (hue-rotate, saturate; brightness is a plain scale), applied in order with a clamp between steps as
// the CSS chain is, by the fragment shader on the dragon's texture only (never on its pieces). The
// spike measured the result against Chrome's own ctx.filter: mean error 0.25-0.54/255, at most 2/255.
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];
export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** One step's matrix, row-major, as the Filter Effects spec writes it. */
export function filterStep(fn: string, value: number): Mat3 {
  switch (fn) {
    case 'hue-rotate': {
      const a = (value * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      return [
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
      ];
    }
    case 'saturate':
      return [
        0.213 + 0.787 * value, 0.715 - 0.715 * value, 0.072 - 0.072 * value,
        0.213 - 0.213 * value, 0.715 + 0.285 * value, 0.072 - 0.072 * value,
        0.213 - 0.213 * value, 0.715 - 0.715 * value, 0.072 + 0.928 * value,
      ];
    case 'brightness':
      return [value, 0, 0, 0, value, 0, 0, 0, value];
    default:
      throw new Error(`unsupported filter function: ${fn}`);
  }
}

const STEP = /([a-z-]+)\(\s*([-+]?(?:\d+\.?\d*|\.\d+))(deg|%)?\s*\)/y;

/** The steps of a CSS filter string; throws on anything else than `fn(number[unit])` steps. */
export function parseFilter(css: string): { fn: string; value: number }[] {
  const s = css.trim();
  if (s === '' || s === 'none') return [];
  const out: { fn: string; value: number }[] = [];
  let i = 0;
  while (i < s.length) {
    while (s[i] === ' ') i++;
    if (i >= s.length) break;
    STEP.lastIndex = i;
    const m = STEP.exec(s);
    if (!m) throw new Error(`cannot read the filter «\u202F${css}\u202F»`);
    const [, fn, num, unit] = m;
    let value = Number(num);
    if (fn === 'hue-rotate') {
      if (unit !== 'deg' && !(unit === undefined && value === 0)) throw new Error(`hue-rotate needs degrees: «\u202F${css}\u202F»`);
    } else {
      if (unit === 'deg') throw new Error(`${fn} takes no angle: «\u202F${css}\u202F»`);
      if (unit === '%') value /= 100;
    }
    out.push({ fn, value });
    i = STEP.lastIndex;
  }
  return out;
}

const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

/** The shader's two tint steps, column-major (GLSL mat3); identity for a missing step. */
export function filterMatrices(css: string): [Mat3, Mat3] {
  const steps = parseFilter(css).map(({ fn, value }) => transpose(filterStep(fn, value)));
  if (steps.length > 2) throw new Error(`at most two filter steps: «\u202F${css}\u202F»`);
  while (steps.length < 2) steps.push(IDENTITY);
  return [steps[0], steps[1]];
}

/** The fragment shader's tint on one colour (0..1), clamped after each step, then mixed with the
 *  untinted colour by `strength` (1 = the full tint, 0 = the original). */
export function applyTint([a, b]: [Mat3, Mat3], rgb: readonly [number, number, number], strength = 1): [number, number, number] {
  const mul = (m: Mat3, v: readonly number[]): [number, number, number] =>
    [0, 1, 2].map((r) => Math.min(1, Math.max(0, m[r] * v[0] + m[3 + r] * v[1] + m[6 + r] * v[2]))) as [number, number, number];
  const tinted = mul(b, mul(a, rgb));
  return [0, 1, 2].map((i) => rgb[i] + (tinted[i] - rgb[i]) * strength) as [number, number, number];
}
