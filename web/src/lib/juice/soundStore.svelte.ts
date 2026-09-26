// UI5 Ruling E1: the single mute became three channels (lib/audio/store.svelte.ts). Until the HUD
// and the lyre move to them (UI5 Task 5, which deletes this file), « muted » means the music and
// the effects, never the dictation's voice (« La dictée est toujours lue »).
import { bothMuted, setChannels } from '../audio/store.svelte';

export const soundStore = {
  get muted(): boolean {
    return bothMuted();
  },
};

export async function setMuted(profileId: number, muted: boolean): Promise<void> {
  setChannels(profileId, { music: { muted }, sfx: { muted } });
}
