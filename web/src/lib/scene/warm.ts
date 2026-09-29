// The paintings of the places the player is likely to open next, fetched ahead (spec §4
// performance). The server tells the browser to store nothing (server/app/static.py, `no-store`), so
// an image dropped once fetched would be fetched again when its place opens: each warmed painting is
// kept here, as a loaded <img>, for the page's life (a few WebPs, each within the scenes' budget), and
// the place's own <img> of the same URL reuses it.
const warmed = new Map<string, HTMLImageElement>();

export function warm(src: string): void {
  if (warmed.has(src)) return;
  const img = new Image();
  img.src = src;
  warmed.set(src, img);
}
