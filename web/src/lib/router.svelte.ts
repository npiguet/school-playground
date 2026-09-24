// Tiny in-house hash router (spec's "Decisions" #10): reactive current route +
// navigation helper. No third-party router dependency.
import { matchRoute, type Route } from './routes';

export const router = $state<{ route: Route }>({
  route: matchRoute(typeof location === 'undefined' ? '' : location.hash),
});

export function startRouter() {
  window.addEventListener('hashchange', () => {
    router.route = matchRoute(location.hash);
  });
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
