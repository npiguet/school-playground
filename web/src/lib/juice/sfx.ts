// UI5 Ruling E1: the effects are CC0 recordings (lib/audio/catalog.ts) played by the one mixer. This
// module keeps the two calls the screens have always made. Both run inside a tap: `unlockAudio`
// first (iOS starts audio only from a gesture), then any `playSfx`. Sound is a convenience, never a
// blocker: withAudio swallows any mixer failure.
import { withAudio } from '../audio/audio.svelte';
import type { SfxId } from '../audio/catalog';

export type Sfx = SfxId;

export function unlockAudio(): void {
  withAudio((e) => e.unlock());
}

export function playSfx(name: Sfx): void {
  withAudio((e) => e.sfx(name));
}
