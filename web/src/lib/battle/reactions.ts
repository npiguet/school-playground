// reactions.ts — how a combatant reacts (UI4 Ruling C10): Web Animations keyframes, in screen space,
// on the combatant's outer `.actor` (its inner `.facing` mirrors the art). `away` is +1 for the
// opponent on the right (pushed right), -1 for the dragon on the left. Reduced motion: opacity and
// brightness only (spec §4 "fades only").
export const REACTIONS = ['idle', 'taunt', 'flinch', 'hit', 'defeat', 'retreat', 'cheer', 'brace'] as const;
export type Reaction = (typeof REACTIONS)[number];
export interface ReactionAnim {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

export function reactionAnimation(r: Reaction, o: { away: 1 | -1; reduced: boolean }): ReactionAnim | null {
  const x = (px: number) => `translateX(${px * o.away}px)`;
  if (o.reduced) {
    if (r === 'hit') return { keyframes: [{ filter: 'brightness(1)' }, { filter: 'brightness(1.6)' }, { filter: 'brightness(1)' }], options: { duration: 300 } };
    if (r === 'defeat') return { keyframes: [{ opacity: 1, filter: 'grayscale(0)' }, { opacity: 0.55, filter: 'grayscale(0.6)' }], options: { duration: 400, fill: 'forwards' } };
    if (r === 'retreat') return { keyframes: [{ opacity: 1 }, { opacity: 0.75 }], options: { duration: 400, fill: 'forwards' } };
    return null;
  }
  switch (r) {
    case 'idle':
      return null;
    case 'taunt':
      return {
        keyframes: [
          { transform: 'rotate(0deg) translateY(0)' },
          { transform: `rotate(${-4 * o.away}deg) translateY(-6px)` },
          { transform: `rotate(${3 * o.away}deg) translateY(0)` },
          { transform: 'rotate(0deg) translateY(0)' },
        ],
        options: { duration: 900, easing: 'ease-in-out' },
      };
    case 'flinch':
      return { keyframes: [{ transform: x(0) }, { transform: x(8) }, { transform: x(-3) }, { transform: x(0) }], options: { duration: 320 } };
    case 'hit':
      return {
        keyframes: [
          { transform: x(0), filter: 'brightness(1)' },
          { transform: `${x(14)} rotate(${3 * o.away}deg)`, filter: 'brightness(1.8) saturate(0.6)' },
          { transform: x(-6), filter: 'brightness(1.1)' },
          { transform: x(0), filter: 'brightness(1)' },
        ],
        options: { duration: 360, easing: 'cubic-bezier(.3,.7,.4,1)' },
      };
    case 'defeat':
      return {
        keyframes: [
          { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: 1, filter: 'grayscale(0) brightness(1)' },
          { transform: `translateY(4%) rotate(${8 * o.away}deg) scale(0.96)`, opacity: 0.55, filter: 'grayscale(0.6) brightness(0.8)' },
        ],
        options: { duration: 900, easing: 'ease-in', fill: 'forwards' },
      };
    case 'retreat':
      return {
        keyframes: [
          { transform: 'translateX(0) scale(1)', opacity: 1 },
          { transform: `translateX(${12 * o.away}%) scale(0.92)`, opacity: 0.75 },
        ],
        options: { duration: 800, easing: 'ease-in-out', fill: 'forwards' },
      };
    case 'cheer':
      return {
        keyframes: [{ transform: 'translateY(0)' }, { transform: 'translateY(-10%)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-5%)' }, { transform: 'translateY(0)' }],
        options: { duration: 900, easing: 'ease-out' },
      };
    case 'brace':
      return { keyframes: [{ transform: 'scale(1)' }, { transform: `${x(-6)} scale(1.03)` }, { transform: 'scale(1)' }], options: { duration: 600 } };
  }
}
