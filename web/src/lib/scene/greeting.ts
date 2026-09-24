// The dragon greets once per profile per page load (plan Ruling 10). Module state on purpose: a
// reload is a new visit, a hash navigation back to the camp is not.
const greeted = new Set<number>();

export function shouldGreet(profileId: number): boolean {
  return !greeted.has(profileId);
}

export function markGreeted(profileId: number): void {
  greeted.add(profileId);
}

// UI3 Ruling A9: the places' static greetings (owl, Pythia...), keyed `<place>:<profileId>`.
const greetedKeys = new Set<string>();

export function shouldGreetKey(key: string): boolean {
  return !greetedKeys.has(key);
}

export function markGreetedKey(key: string): void {
  greetedKeys.add(key);
}

/** Test helper: forget every greeting (what a page reload does). */
export function resetGreetings(): void {
  greeted.clear();
  greetedKeys.clear();
}
