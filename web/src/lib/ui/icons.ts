// One family of inline line icons (UI3 Ruling A13), 32×32 viewBox, drawn in currentColor: the
// lyre, the seal's cross, the open journal and the shield are the UI1 drawings (Hud, Overlay, the
// hero-panel medallions), now shared; the rest replaces the pictograph characters (arrows, check
// mark, star, gap marker, pencil).
export type IconName =
  | 'lyre'
  | 'lyre-muted'
  | 'close'
  | 'journal'
  | 'shield'
  | 'lamp'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow-down'
  | 'check'
  | 'star'
  | 'pencil'
  | 'gap'
  | 'plus'
  | 'laurel'
  | 'chevron'
  | 'music'
  | 'music-muted'
  | 'bell'
  | 'bell-muted'
  | 'voice'
  | 'voice-muted';

export interface IconPath {
  d: string;
  /** Stroke width in viewBox units (default 2.4). */
  width?: number;
  /** Filled with currentColor instead of stroked. */
  fill?: boolean;
  /** Stroked in `--icon-halo` (the surface behind the icon), under the next path, for contrast
   *  (the mute slash). */
  halo?: boolean;
  dash?: string;
}

const LYRE: IconPath[] = [
  { d: 'M11 27C6 22 4 14 7 8c1-2 3-3 4-2M21 27c5-5 7-13 4-19-1-2-3-3-4-2' },
  { d: 'M7 10h18M10 27h12' },
  { d: 'M13 10v17M16 10v17M19 10v17', width: 1.3 },
];

// The sound plate's three channels (UI5 Ruling E8): a kithara (square-armed, a sound box at its
// foot, so it is not mistaken for the HUD's lyre) for the music, a hand bell for the effects, a
// speaking scroll for the dictation's voice.
const KITHARA: IconPath[] = [
  { d: 'M8 21h16v6H8zM10 21L8 6M22 21l2-15', width: 2.2 },
  { d: 'M6 8h20', width: 2.2 },
  { d: 'M13 8v13M16 8v13M19 8v13', width: 1.3 },
];
const BELL: IconPath[] = [
  { d: 'M16 4v4', width: 2.6 },
  { d: 'M7 23c1.5-2 2-4 2-8 0-4 3-7 7-7s7 3 7 7c0 4 .5 6 2 8z', width: 2.2 },
  { d: 'M14 26.5a2 2 0 0 0 4 0', width: 2.2 },
];
const SCROLL_VOICE: IconPath[] = [
  { d: 'M5 8h12M5 24h12M6 8v16M16 8v16', width: 2.2 },
  { d: 'M9 13h4M9 16.5h4M9 20h4', width: 1.5 },
  { d: 'M20.5 13c1.5 1.8 1.5 4.2 0 6M24 10c3 3.5 3 8.5 0 12', width: 2 },
];
/** An icon struck through (the mute): the halo keeps the slash legible over the drawing. */
const struck = (paths: IconPath[]): IconPath[] => [...paths, { d: 'M5 27L27 5', width: 5, halo: true }, { d: 'M5 27L27 5' }];

export const ICONS: Record<IconName, IconPath[]> = {
  lyre: LYRE,
  'lyre-muted': struck(LYRE),
  music: KITHARA,
  'music-muted': struck(KITHARA),
  bell: BELL,
  'bell-muted': struck(BELL),
  voice: SCROLL_VOICE,
  'voice-muted': struck(SCROLL_VOICE),
  close: [{ d: 'M9 9L23 23M23 9L9 23', width: 3 }],
  journal: [
    { d: 'M7 6h8c1 0 1 1 1 2v18c0-1-1-2-2-2H7z M25 6h-8c-1 0-1 1-1 2v18c0-1 1-2 2-2h7z', width: 2.2 },
    { d: 'M10 11h3M10 15h3M19 11h3M19 15h3', width: 1.6 },
  ],
  shield: [{ d: 'M16 4l10 4v7c0 7-5 11-10 13C11 26 6 22 6 15V8z' }, { d: 'M16 9v14M11 15h10', width: 2 }],
  lamp: [
    { d: 'M5 21c4 3 14 3 18 0l4-4h-5c-3-2-10-2-13 0z', width: 2.2 },
    { d: 'M16 15c-2-3 1-5 0-9 3 3 4 6 0 9z', width: 1.8 },
    { d: 'M12 25h8', width: 2.2 },
  ],
  'arrow-left': [{ d: 'M19 7L10 16l9 9', width: 3 }],
  'arrow-right': [{ d: 'M13 7l9 9-9 9', width: 3 }],
  // The Bouclier's steps up and down the page (UI4 playability #6).
  'arrow-up': [{ d: 'M7 19l9-9 9 9', width: 3 }],
  'arrow-down': [{ d: 'M7 13l9 9 9-9', width: 3 }],
  check: [{ d: 'M7 17l6 6L25 9', width: 3 }],
  star: [{ d: 'M16 4l3.5 7.6 8.3.9-6.2 5.6 1.8 8.2L16 22.1l-7.4 4.2 1.8-8.2-6.2-5.6 8.3-.9z', fill: true }],
  pencil: [{ d: 'M7 25l2-6L21 7l4 4-12 12z', width: 2.2 }, { d: 'M18 10l4 4', width: 2 }],
  gap: [{ d: 'M7 9h18v14H7z', width: 2, dash: '3 3' }],
  plus: [{ d: 'M16 7v18M7 16h18', width: 3.2 }],
  // A laurel sprig laid on a broken seal (a defended text, immersion wave Task 8).
  laurel: [
    { d: 'M7 27C12 22 18 15 25 5', width: 2 },
    {
      d: 'M11 22c-3 0-5-2-5-4 3 0 5 2 5 4zM14 18c-3-1-4-3-4-5 3 1 4 3 4 5zM17 14c-2-1-3-3-3-5 2 1 3 3 3 5zM15 23c1-3 3-4 5-4-1 3-3 4-5 4zM18 19c1-3 3-4 5-4-1 3-3 4-5 4zM21 15c1-2 3-3 5-3-1 2-3 3-5 3z',
      fill: true,
    },
  ],
  // A small open/closed cue on a toggle (B2 fix round 1 #4): points down, rotated 180° when open.
  chevron: [{ d: 'M8 12l8 8 8-8', width: 3 }],
};
