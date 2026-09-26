// The dictation's voice is speechSynthesis (lib/dictation/tts.ts), not a Howler sound: here is what it
// needs from the audio side (Rulings E5, E7). Its gain is the voice channel's (a muted voice speaks
// at 0, keeping the dictation's pace); while it speaks the music ducks and effects wait.
import { audio } from './audio.svelte';
import { audioSettings } from './store.svelte';
import { gainOf } from './settings';

export const voiceGain = (): number => gainOf(audioSettings.voice);

export function voiceSpeaking(on: boolean): void {
  try {
    audio().voice(on);
  } catch {
    // Sound is a convenience.
  }
}
