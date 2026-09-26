// The journal's words (UI3 Ruling B6): what the Muses do at each help stage, said the camp's way
// (the old Stats said « niveau N sur 4 » and « Comme en classe », school register).
export const HELP_STAGES = [1, 2, 3, 4] as const;

const LINES: Record<number, string> = {
  1: "Les yeux d'Argus éclairent chaque piège.",
  2: 'Les Muses nomment les passes, sans les éclairer.',
  3: 'Les Muses annoncent seulement le nombre de pièges.',
  4: 'Les Muses te laissent relire sans aide.',
};

export function helpStageLine(stage: number): string {
  return LINES[stage] ?? '';
}
