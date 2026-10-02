// The living dragon's tint (spec 2026-10-02 living dragon, "Tint"). TINT_FILTERS (world/dragon.ts) stay
// the single source: their CSS functions are turned into the Filter Effects 1 colour matrices
// (hue-rotate, saturate; brightness is a plain scale), applied in order with a clamp between steps as
// the CSS chain is, by the fragment shader on the dragon's texture only (never on its pieces). The
// spike measured the result against Chrome's own ctx.filter: mean error 0.25-0.54/255, at most 2/255.
import { TINT_STRENGTH } from '../world/dragon';

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

// ---- The lab's tint methods (user, 2026-10-02: "can we try working in the HSV color space, and maybe
// try rotating the H channel?"). Three ways to tint, compared side by side in the lab: the CSS matrices
// above (mode 0, the game's), HSV (mode 1: H turned, S and V scaled) and OKLCH (mode 2: perceptual, a
// hue turn keeps the perceived lightness; C and L scaled, out-of-gamut colours brought back by lowering
// C). These pure functions are the CPU reference of the fragment shader's modes (renderer.ts).

export type Rgb = readonly [number, number, number];
export type TintMode = 'css' | 'hsv' | 'oklch';
/** One method's settings: hue shift in degrees, saturation (S or C) and value (V or L) factors, and the
 *  mix with the untinted colour. In mode `css` they are hue-rotate, saturate and brightness. */
export interface TintSpec {
  mode: TintMode;
  shift: number;
  sat: number;
  val: number;
  strength: number;
}
export const TINT_MODE_INDEX: Record<TintMode, number> = { css: 0, hsv: 1, oklch: 2 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const fract = (v: number) => v - Math.floor(v);

/** HSV with H in 0..1 (the shader's form). */
export function rgbToHsv([r, g, b]: Rgb): [number, number, number] {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = (g - b) / d / 6;
    else if (max === g) h = (b - r) / d / 6 + 1 / 3;
    else h = (r - g) / d / 6 + 2 / 3;
  }
  return [fract(h), max > 0 ? d / max : 0, max];
}

export function hsvToRgb([h, s, v]: readonly [number, number, number]): [number, number, number] {
  const k = [1, 2 / 3, 1 / 3].map((o) => clamp01(Math.abs(fract(h + o) * 6 - 3) - 1));
  return [0, 1, 2].map((i) => v * (1 + (k[i] - 1) * s)) as [number, number, number];
}

export function tintHsv(rgb: Rgb, shift: number, sat: number, val: number): [number, number, number] {
  const [h, s, v] = rgbToHsv(rgb);
  return hsvToRgb([fract(h + shift / 360), clamp01(s * sat), clamp01(v * val)]);
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** OKLab (Ottosson 2020) from linear sRGB, and back. */
function linearToOklab([r, g, b]: Rgb): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]: Rgb): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLCH (L 0..1, C, h in degrees) of a straight sRGB colour. */
export function rgbToOklch(rgb: Rgb): [number, number, number] {
  const [L, a, b] = linearToOklab(rgb.map(toLinear) as unknown as Rgb);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, Math.hypot(a, b), h < 0 ? h + 360 : h];
}

function oklchToLinear([L, C, h]: Rgb): [number, number, number] {
  const a = (h * Math.PI) / 180;
  return oklabToLinear([L, C * Math.cos(a), C * Math.sin(a)]);
}

/** sRGB of an OKLCH colour, unclipped (may leave 0..1 when out of gamut). */
export function oklchToRgb(lch: Rgb): [number, number, number] {
  return oklchToLinear(lch).map((c) => Math.sign(c) * toSrgb(Math.abs(c))) as [number, number, number];
}

const GAMUT_EPS = 1e-4;
const inGamut = (lin: Rgb) => lin.every((c) => c >= -GAMUT_EPS && c <= 1 + GAMUT_EPS);
/** The shader's bisection steps on the chroma: 2^-16 of it. */
export const GAMUT_STEPS = 16;

export function tintOklch(rgb: Rgb, shift: number, sat: number, val: number): [number, number, number] {
  const [L0, C0, h0] = rgbToOklch(rgb);
  const L = clamp01(L0 * val);
  const h = h0 + shift;
  let C = C0 * sat;
  if (!inGamut(oklchToLinear([L, C, h]))) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < GAMUT_STEPS; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear([L, mid, h]))) lo = mid;
      else hi = mid;
    }
    C = lo;
  }
  return oklchToLinear([L, C, h]).map((c) => toSrgb(clamp01(c))) as [number, number, number];
}

/** Mode `css`'s two matrices (column-major, as filterMatrices): hue-rotate, then saturate with the
 *  brightness folded in (a plain scale; the same as its own clamped step for every dragon tint). */
export function cssSpecMatrices({ shift, sat, val }: TintSpec): [Mat3, Mat3] {
  const hue = shift === 0 ? IDENTITY : transpose(filterStep('hue-rotate', shift));
  if (sat === 1 && val === 1) return [hue, IDENTITY];
  const s = filterStep('saturate', sat).map((v) => v * val) as unknown as Mat3;
  return [hue, transpose(s)];
}

/** One straight colour through a method, mixed with the original by its strength. */
export function tintPixel(spec: TintSpec, rgb: Rgb): [number, number, number] {
  const { mode, shift, sat, val, strength } = spec;
  if (mode === 'css') return applyTint(cssSpecMatrices(spec), rgb, strength);
  const t = mode === 'hsv' ? tintHsv(rgb, shift, sat, val) : tintOklch(rgb, shift, sat, val);
  return [0, 1, 2].map((i) => rgb[i] + (t[i] - rgb[i]) * strength) as [number, number, number];
}

/** The bronze dragon's colour (TINT_SWATCH.bronze, #b8863b): the reference a preset's shift is measured on. */
const BRONZE: Rgb = [184 / 255, 134 / 255, 59 / 255];
/** An angle in -180..180. */
const wrap = (deg: number) => deg - 360 * Math.round(deg / 360);

/** A method's starting point for a TINT_FILTERS entry: its saturate and brightness, the strength the
 *  game uses, and the hue shift that turns the bronze where the CSS tint turns it (CSS hue-rotate is
 *  no true hue turn: 190deg on the bronze is a smaller turn in HSV or OKLCH). */
export function presetSpec(css: string, mode: TintMode, strength = TINT_STRENGTH): TintSpec {
  const steps = parseFilter(css);
  const value = (fn: string, none: number) => steps.find((s) => s.fn === fn)?.value ?? none;
  const angle = value('hue-rotate', 0);
  const spec: TintSpec = { mode, shift: Math.round(wrap(angle)), sat: value('saturate', 1), val: value('brightness', 1), strength };
  if (mode === 'css' || angle === 0) return spec;
  const hue = mode === 'hsv' ? (c: Rgb) => rgbToHsv(c)[0] * 360 : (c: Rgb) => rgbToOklch(c)[2];
  spec.shift = Math.round(wrap(hue(applyTint(filterMatrices(css), BRONZE)) - hue(BRONZE)));
  return spec;
}

/** The CSS filter a mode-`css` spec stands for. */
export function specFilter({ shift, sat, val }: TintSpec): string {
  const parts = [shift !== 0 && `hue-rotate(${shift}deg)`, sat !== 1 && `saturate(${+sat.toFixed(2)})`, val !== 1 && `brightness(${+val.toFixed(2)})`];
  return parts.filter(Boolean).join(' ') || 'none';
}

/** The lab's copyable line, e.g. `ecume: oklch shift 150 sat 0.90 val 1.00 strength 0.70`. */
export function tintText(name: string, spec: TintSpec): string {
  // An English, code-like line (not French copy): the name is glued to its colon.
  const head = name + ':';
  const line = [head, spec.mode, 'shift', spec.shift, 'sat', spec.sat.toFixed(2), 'val', spec.val.toFixed(2), 'strength', spec.strength.toFixed(2)].join(' ');
  return spec.mode === 'css' ? `${line} (${specFilter(spec)})` : line;
}
