// The build the server runs (GET /api/health's `build`: the image's GIT_COMMIT and BUILD_DATE build
// args, "unknown" without them), shown as the last line of the lyre's credits. Read from the server,
// not baked into the bundle, so the page and the server always name the same build.
import { dayMonthYear } from './text/french';

export interface BuildStamp {
  commit: string;
  date: string;
}

const UNKNOWN = 'unknown';

/** « version b68ecc8 · 29 septembre 2026 », « version inconnue »; null without a stamp. */
export function buildLine(build: BuildStamp | null | undefined): string | null {
  if (!build) return null;
  const version = build.commit === UNKNOWN ? 'version inconnue' : `version ${build.commit}`;
  const day = dayMonthYear(build.date);
  return day ? `${version} · ${day}` : version;
}
