// The dictation's voice is speechSynthesis (lib/dictation/tts.ts), not a Howler sound: here is what it
// needs from the audio side (Rulings E5, E7). Its gain is the voice channel's; a muted voice is not
// spoken at all (Ruling E7b: iOS ignores an utterance's volume), tts.ts waits its length instead.
// While it speaks the music ducks and effects wait.
import { withAudio } from './audio.svelte';
import { audioSettings } from './store.svelte';
import { gainOf } from './settings';

export const voiceGain = (): number => gainOf(audioSettings.voice);
export const voiceMuted = (): boolean => audioSettings.voice.muted;

export function voiceSpeaking(on: boolean): void {
  withAudio((e) => e.voice(on));
}
