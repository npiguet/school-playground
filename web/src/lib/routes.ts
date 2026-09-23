// Tiny in-house hash router: route patterns and matching (spec's "Decisions" #10 —
// no third-party router). Pure functions, no DOM access besides the `hash` string
// passed in, so they are trivially unit-testable.

export type RouteName =
  | 'profiles'
  | 'profile-new'
  | 'library'
  | 'text-new'
  | 'play'
  | 'stats'
  | 'settings';

export interface Route {
  name: RouteName;
  params: Record<string, string>;
}

const PROFILES: Route = { name: 'profiles', params: {} };

interface Pattern {
  name: RouteName;
  // Segment matchers: a plain string matches literally, a function captures a param.
  segments: (string | { param: string })[];
}

const PATTERNS: Pattern[] = [
  { name: 'profile-new', segments: ['profiles', 'new'] },
  { name: 'library', segments: ['p', { param: 'profileId' }, 'camp'] },
  { name: 'text-new', segments: ['p', { param: 'profileId' }, 'texts', 'new'] },
  { name: 'play', segments: ['p', { param: 'profileId' }, 'play', { param: 'textId' }] },
  { name: 'stats', segments: ['p', { param: 'profileId' }, 'stats'] },
  { name: 'settings', segments: ['p', { param: 'profileId' }, 'settings'] },
];

/** Parses a `location.hash` value (with or without the leading `#`) into a Route. */
export function matchRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const segments = path.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return PROFILES;

  for (const pattern of PATTERNS) {
    if (pattern.segments.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < pattern.segments.length; i++) {
      const seg = pattern.segments[i];
      if (typeof seg === 'string') {
        if (seg !== segments[i]) {
          ok = false;
          break;
        }
      } else {
        params[seg.param] = segments[i];
      }
    }
    if (ok) return { name: pattern.name, params };
  }
  return PROFILES;
}

/** Builds a `#/...` href for a route name and its params. */
export function href(name: RouteName, params: Record<string, string> = {}): string {
  switch (name) {
    case 'profiles':
      return '#/';
    case 'profile-new':
      return '#/profiles/new';
    case 'library':
      return `#/p/${params.profileId}/camp`;
    case 'text-new':
      return `#/p/${params.profileId}/texts/new`;
    case 'play':
      return `#/p/${params.profileId}/play/${params.textId}`;
    case 'stats':
      return `#/p/${params.profileId}/stats`;
    case 'settings':
      return `#/p/${params.profileId}/settings`;
  }
}
