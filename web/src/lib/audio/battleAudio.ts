// The battle on the mixer (UI4 Ruling C9's hooks, Rulings E4-E6): its ground's loop, the ducking of
// its dictation and proofreading phases, a blow per reckoning strike, a fanfare for a rout.
import { onBattleEvent } from '../battle/events';
import { battleTrack } from './catalog';
import type { AudioEngine } from './engine';

export function listenToBattle(e: AudioEngine): () => void {
  const stop = onBattleEvent((ev) => {
    switch (ev.kind) {
      case 'start':
        e.music(battleTrack(ev.backdrop));
        break;
      case 'phase':
        e.duck('dictation', ev.phase === 'dictation');
        e.duck('proofreading', ev.phase === 'proofreading');
        break;
      case 'strike':
        e.sfx('strike');
        break;
      case 'outcome':
        if (ev.outcome === 'rout') e.sfx('fanfare');
        break;
      case 'leave':
        e.duck('dictation', false);
        e.duck('proofreading', false);
        break;
    }
  });
  return () => void stop();
}
