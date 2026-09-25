// Every place greets once per profile per page load (plan Ruling 10, UI3 Ruling A9): the dragon at
// the camp, the owl in the library tent, the Pythia at Delphi. Module state on purpose: a reload is
// a new visit, a hash navigation back to a place is not. One key per place and hero,
// `<place>:<profileId>` (final review M2: the camp's own per-profile API is folded in here).
const greeted = new Set<string>();

export function greetKey(place: string, profileId: number): string {
  return `${place}:${profileId}`;
}

export function shouldGreet(key: string): boolean {
  return !greeted.has(key);
}

export function markGreeted(key: string): void {
  greeted.add(key);
}

/** Test helper: forget every greeting (what a page reload does). */
export function resetGreetings(): void {
  greeted.clear();
}
