// Swiss HarmoS levels and avatars (spec §3.1; plan "Conventions").
// French grade equivalents (code comment only, never shown to the player):
// 5H=CE2, 6H=CM1, 7H=CM2, 8H=6e, 9H=5e, 10H=4e, 11H=3e.

export const LEVELS = ['5H', '6H', '7H', '8H', '9H', '10H', '11H'] as const;
export type Level = (typeof LEVELS)[number];

export const AVATARS = ['chouette', 'dragon', 'lyre', 'trident', 'laurier', 'foudre'] as const;
export type Avatar = (typeof AVATARS)[number];

export function levelIndex(level: string): number {
  return LEVELS.indexOf(level as Level);
}

/** e.g. `"10H"` — HarmoS levels are already short and shown as-is. */
export function levelLabel(level: string): string {
  return level;
}

/** Past participles (avoir/être) are only in the "Verbes" Argus pass from 8H up (spec §3.4). */
export function includesParticiplesInVerbPass(level: string): boolean {
  return levelIndex(level) >= levelIndex('8H');
}
