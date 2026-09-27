// The dictation's voice on the mixer (spec 2026-09-27 §5.1): each line plays on the voice channel through
// `playLine`; a muted voice fetches and plays nothing (lib/dictation/voice.ts waits the line's length
// instead).
import { withAudio } from './audio.svelte';
import { audioSettings } from './store.svelte';
import { silentLine, type LineHandle, type VoiceClip } from './engine';

export const voiceMuted = (): boolean => audioSettings.voice.muted;

/** Plays one line of the dictation's voice (the music ducks under it, effects wait). A mixer that throws
 *  plays it silently at its length: the dictation goes on. */
export function playLine(clip: VoiceClip): LineHandle {
  let handle: LineHandle | null = null;
  withAudio((e) => (handle = e.say(clip)));
  return handle ?? silentLine(clip.ms);
}
