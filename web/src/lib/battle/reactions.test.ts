import { describe, expect, it } from 'vitest';
import { REACTIONS, reactionAnimation } from './reactions';

describe('reactions on the cut-outs (Ruling C10)', () => {
  it('animates every reaction but idle, and pushes a hit away from the other side', () => {
    expect(reactionAnimation('idle', { away: 1, reduced: false })).toBeNull();
    for (const r of REACTIONS.filter((x) => x !== 'idle')) expect(reactionAnimation(r, { away: 1, reduced: false }), r).not.toBeNull();
    expect(JSON.stringify(reactionAnimation('hit', { away: 1, reduced: false })!.keyframes)).toContain('translateX(14px)');
    expect(JSON.stringify(reactionAnimation('hit', { away: -1, reduced: false })!.keyframes)).toContain('translateX(-14px)');
  });

  it('holds the end pose of a defeat and a retreat', () => {
    expect(reactionAnimation('defeat', { away: 1, reduced: false })!.options.fill).toBe('forwards');
    expect(reactionAnimation('retreat', { away: 1, reduced: false })!.options.fill).toBe('forwards');
  });

  it('never moves anything under reduced motion: opacity and brightness only', () => {
    for (const r of REACTIONS) {
      const a = reactionAnimation(r, { away: 1, reduced: true });
      if (!a) continue;
      for (const k of a.keyframes) expect(Object.keys(k).every((p) => p === 'opacity' || p === 'filter' || p === 'offset'), r).toBe(true);
    }
  });
});
