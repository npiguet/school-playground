// The dragon greets once per profile per page load (plan Ruling 10). Module state on purpose: a
// reload is a new visit, a hash navigation back to the camp is not.
const greeted = new Set<number>();

export function shouldGreet(profileId: number): boolean {
  return !greeted.has(profileId);
}

export function markGreeted(profileId: number): void {
  greeted.add(profileId);
}

/** Test helper: forget every greeting (what a page reload does). */
export function resetGreetings(): void {
  greeted.clear();
}
