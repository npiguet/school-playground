// Tiny in-house hash router (spec's "Decisions" #10): reactive current route +
// navigation helper. No third-party router dependency.
import { matchRoute, type Route } from './routes';
import { noteBattleOrigin, stampFirstEntry } from './battle/origin';

const initialHash = typeof location === 'undefined' ? '' : location.hash;

// `hash` is the location hash `route` was matched from: until the `hashchange` of a navigation
// has been handled, `location.hash` is already the new one while the screen still shows the old.
export const router = $state<{ route: Route; hash: string }>({
  route: matchRoute(initialHash),
  hash: initialHash,
});

export function startRouter() {
  // Where a battle was opened from, for its « Quitter » (lib/battle/origin.ts): every battle entry
  // is stamped once, when it is created - the first one here, every later one on its hashchange.
  stampFirstEntry(location.hash, history);
  window.addEventListener('hashchange', () => {
    const left = router.hash;
    router.hash = location.hash;
    router.route = matchRoute(location.hash);
    noteBattleOrigin(left, router.route, history);
  });
}

/** True between a navigation changing the URL and the app handling its `hashchange`: the screen
 *  on show is already on its way out. */
export function navigationPending(): boolean {
  return typeof location !== 'undefined' && location.hash !== router.hash;
}

export function navigate(path: string) {
  location.hash = path.startsWith('#') ? path : '#' + path;
}

/** Replaces the current history entry instead of pushing one (a closed overlay must not leave a
 *  "reopen me" entry behind for Back). Fires `hashchange` like `navigate`. */
export function replaceRoute(path: string) {
  const hash = path.startsWith('#') ? path : '#' + path;
  location.replace(location.pathname + location.search + hash);
}
