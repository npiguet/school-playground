// Tiny in-house hash router: route patterns and matching (spec's "Decisions" #10 —
// no third-party router). Pure functions, no DOM access besides the `hash` string
// passed in, so they are trivially unit-testable.

export type RouteName =
  | 'profiles'
  | 'profile-new'
  | 'camp'
  | 'library-tent'
  | 'delphi'
  | 'war-tent'
  | 'library'
  | 'text-new'
  | 'text-scan'
  | 'grimoire'
  | 'alexandria'
  | 'alexandria-work'
  | 'play'
  | 'stats'
  | 'settings'
  | 'dossier'
  | 'bestiaire'
  | 'bestiaire-entry'
  | 'lieutenant'
  | 'oracle'
  | 'quests'
  | 'boss'
  | 'dragon'
  | 'cabin';

export interface Route {
  name: RouteName;
  params: Record<string, string>;
  /** Parsed from a trailing `?k=v&...` (SP3 decision 14): `play`/`grimoire` carry `quest`,
   *  `encounter`, `focus`, `help` this way. Empty object when the hash has no query string. */
  query: Record<string, string>;
}

interface Pattern {
  name: RouteName;
  // Segment matchers: a plain string matches literally, a function captures a param.
  segments: (string | { param: string })[];
}

const PATTERNS: Pattern[] = [
  { name: 'profile-new', segments: ['profiles', 'new'] },
  { name: 'camp', segments: ['p', { param: 'profileId' }, 'camp'] },
  // The hub took over `/camp` (SP3 decision 14); the library moved to `/parchemins`, but the
  // route *name* stays `library` so every existing `href('library', ...)` call keeps working.
  { name: 'library', segments: ['p', { param: 'profileId' }, 'parchemins'] },
  // UI3 Ruling A1: the bare district scenes; the legacy routes open them with an overlay.
  { name: 'library-tent', segments: ['p', { param: 'profileId' }, 'tente-parchemins'] },
  { name: 'delphi', segments: ['p', { param: 'profileId' }, 'temple'] },
  { name: 'war-tent', segments: ['p', { param: 'profileId' }, 'tente-de-guerre'] },
  { name: 'text-new', segments: ['p', { param: 'profileId' }, 'texts', 'new'] },
  { name: 'text-scan', segments: ['p', { param: 'profileId' }, 'texts', 'scan'] },
  { name: 'grimoire', segments: ['p', { param: 'profileId' }, 'grimoire', { param: 'textId' }] },
  { name: 'alexandria', segments: ['p', { param: 'profileId' }, 'alexandria'] },
  { name: 'alexandria-work', segments: ['p', { param: 'profileId' }, 'alexandria', { param: 'workId' }] },
  { name: 'play', segments: ['p', { param: 'profileId' }, 'play', { param: 'textId' }] },
  { name: 'stats', segments: ['p', { param: 'profileId' }, 'stats'] },
  { name: 'settings', segments: ['p', { param: 'profileId' }, 'settings'] },
  { name: 'dossier', segments: ['p', { param: 'profileId' }, 'dossier'] },
  { name: 'bestiaire-entry', segments: ['p', { param: 'profileId' }, 'bestiaire', { param: 'key' }] },
  { name: 'bestiaire', segments: ['p', { param: 'profileId' }, 'bestiaire'] },
  { name: 'lieutenant', segments: ['p', { param: 'profileId' }, 'monstres', { param: 'key' }] },
  { name: 'oracle', segments: ['p', { param: 'profileId' }, 'delphes'] },
  { name: 'quests', segments: ['p', { param: 'profileId' }, 'quetes'] },
  { name: 'boss', segments: ['p', { param: 'profileId' }, 'eris'] },
  { name: 'dragon', segments: ['p', { param: 'profileId' }, 'dragon'] },
  { name: 'cabin', segments: ['p', { param: 'profileId' }, 'cabane'] },
];

/** Parses a `location.hash` value (with or without the leading `#`) into a Route. */
export function matchRoute(hash: string): Route {
  const withoutHash = hash.replace(/^#/, '');
  const qIndex = withoutHash.indexOf('?');
  const path = qIndex === -1 ? withoutHash : withoutHash.slice(0, qIndex);
  const query = Object.fromEntries(new URLSearchParams(qIndex === -1 ? '' : withoutHash.slice(qIndex + 1)));
  const segments = path.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return { name: 'profiles', params: {}, query };

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
    if (ok) return { name: pattern.name, params, query };
  }
  return { name: 'profiles', params: {}, query };
}

/** Builds a `#/...` href for a route name, its params and (optionally) a query string. */
export function href(name: RouteName, params: Record<string, string> = {}, query?: Record<string, string>): string {
  const base = ((): string => {
    switch (name) {
      case 'profiles':
        return '#/';
      case 'profile-new':
        return '#/profiles/new';
      case 'camp':
        return `#/p/${params.profileId}/camp`;
      case 'library':
        return `#/p/${params.profileId}/parchemins`;
      case 'library-tent':
        return `#/p/${params.profileId}/tente-parchemins`;
      case 'delphi':
        return `#/p/${params.profileId}/temple`;
      case 'war-tent':
        return `#/p/${params.profileId}/tente-de-guerre`;
      case 'text-new':
        return `#/p/${params.profileId}/texts/new`;
      case 'text-scan':
        return `#/p/${params.profileId}/texts/scan`;
      case 'grimoire':
        return `#/p/${params.profileId}/grimoire/${params.textId}`;
      case 'alexandria':
        return `#/p/${params.profileId}/alexandria`;
      case 'alexandria-work':
        return `#/p/${params.profileId}/alexandria/${params.workId}`;
      case 'play':
        return `#/p/${params.profileId}/play/${params.textId}`;
      case 'stats':
        return `#/p/${params.profileId}/stats`;
      case 'settings':
        return `#/p/${params.profileId}/settings`;
      case 'dossier':
        return `#/p/${params.profileId}/dossier`;
      case 'bestiaire':
        return `#/p/${params.profileId}/bestiaire`;
      case 'bestiaire-entry':
        return `#/p/${params.profileId}/bestiaire/${params.key}`;
      case 'lieutenant':
        return `#/p/${params.profileId}/monstres/${params.key}`;
      case 'oracle':
        return `#/p/${params.profileId}/delphes`;
      case 'quests':
        return `#/p/${params.profileId}/quetes`;
      case 'boss':
        return `#/p/${params.profileId}/eris`;
      case 'dragon':
        return `#/p/${params.profileId}/dragon`;
      case 'cabin':
        return `#/p/${params.profileId}/cabane`;
    }
  })();
  if (!query || Object.keys(query).length === 0) return base;
  return `${base}?${new URLSearchParams(query).toString()}`;
}
