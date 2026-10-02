// The dragon's tint (user, 2026-10-02, after comparing the methods in the lab's Teintes panel: "I'm OK
// with keeping the OKLCH variations, with strength at 100%. It looks more natural than the CSS shift").
// Each pixel's colour is taken to OKLCH (Ottosson's perceptual space: a hue turn keeps the perceived
// lightness), its hue turned by `shift` degrees, its chroma and lightness scaled; a colour the turn
// takes out of the sRGB gamut keeps its lightness and hue and loses chroma until it fits. TINT_SPECS
// (world/dragon.ts) hold each tint's settings. These pure functions are the CPU reference: the living
// dragon's fragment shader (renderer.ts) runs the same steps, and the still pictures are tinted with
// them on a canvas (stillTint.ts).

export type Rgb = readonly [number, number, number];

/** A tint's settings: the hue turn in degrees, then the chroma (C) and lightness (L) factors. */
export interface OklchSpec {
  shift: number;
  chroma: number;
  lightness: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
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
/** The bisection steps on the chroma of an out-of-gamut colour: 2^-16 of it (the shader's too). */
export const GAMUT_STEPS = 16;

export function tintOklch(rgb: Rgb, shift: number, chroma: number, lightness: number): [number, number, number] {
  const [L0, C0, h0] = rgbToOklch(rgb);
  const L = clamp01(L0 * lightness);
  const h = h0 + shift;
  let C = C0 * chroma;
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

/** One straight colour (0..1) through a tint; `null` (the bronze) leaves it as it is. */
export function tintPixel(spec: OklchSpec | null, rgb: Rgb): [number, number, number] {
  if (!spec) return [rgb[0], rgb[1], rgb[2]];
  return tintOklch(rgb, spec.shift, spec.chroma, spec.lightness);
}

/** A tint's copyable line (the lab), e.g. `ecume: oklch shift 165 chroma 0.90 lightness 1.00`. */
export function tintText(name: string, spec: OklchSpec | null): string {
  // An English, code-like line (not French copy): the name is glued to its colon.
  const head = name + ':';
  if (!spec) return [head, 'none'].join(' ');
  return [head, 'oklch', 'shift', spec.shift, 'chroma', spec.chroma.toFixed(2), 'lightness', spec.lightness.toFixed(2)].join(' ');
}
