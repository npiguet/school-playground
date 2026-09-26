import { beforeEach, describe, expect, it } from 'vitest';
import { playSfx, unlockAudio } from './sfx';
import { audio } from '../audio/audio.svelte';

describe('the effects façade (Ruling E1)', () => {
  beforeEach(() => audio().scene(null));
  it('keeps the screens\' two calls and routes them to the mixer', () => {
    playSfx('tap');
    expect(audio().snapshot().sfx).not.toContain('tap');
    unlockAudio();
    playSfx('seal');
    expect(audio().snapshot()).toMatchObject({ unlocked: true });
    expect(audio().snapshot().sfx.at(-1)).toBe('seal');
  });
});
