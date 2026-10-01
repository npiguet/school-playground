import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import { createProfileApi, expectCamp, expectLineOf, heroNamer, nextLine } from './helpers';
import { prophecyWhen } from '../src/lib/world/prophecy';

// Spec 2026-09-29 explanations §1, §5: the camp shows each what-next case, from a seeded camp (this
// hero's /camp answer edited; the priority itself is pinned by nextStep.test.ts).
const heroName = heroNamer('Prochain');

// A camp where no case holds: a named hatchling far from its next stage, the week reached, the scrolls
// opened, nothing affordable, no prophecy, no fight.
function calm(c: any) {
  c.xp = { total: 300, floor: 100, next: 1200 };
  c.dragon = { ...c.dragon, stage: 'hatchling', name: 'Braise' };
  c.weekly = { ...c.weekly, target: 3, done: 3, reached: true };
  c.oracle = { ...c.oracle, status: 'chosen' };
  c.affordable = 0;
  c.prophecies = [];
  c.boss = { ...c.boss, tier_available: null };
}
const nearSeal = { level: 2, days: 3, chances: 18, correct: 0.9, complete: false, need: { days: 4, chances: 25, correct: 0.88 } };
const CASES: { name: string; key: string; vars?: Record<string, string>; edit: (c: any) => void }[] = [
  { name: 'name', key: 'camp.next.name', edit: (c) => (c.dragon = { ...c.dragon, name: null }) },
  { name: 'prophecy', key: 'camp.next.prophecy', vars: { when: prophecyWhen(2) }, edit: (c) => (c.prophecies = [{ text_id: 1, title: 'La mer', due_date: '2099-01-02', days_left: 2 }]) },
  { name: 'battle', key: 'camp.next.battle', edit: (c) => (c.boss = { ...c.boss, tier_available: 1, next: null }) },
  { name: 'first-text', key: 'camp.next.first-text', edit: (c) => (c.xp = { total: 0, floor: 0, next: 100 }) },
  {
    name: 'seal',
    key: 'camp.next.seal',
    vars: { lieutenant: "l'Hydre", seal: 'sceau de bronze' },
    edit: (c) => (c.lieutenants = c.lieutenants.map((l: any) => (l.key === 'hydre' ? { ...l, available: true, level: 1, next: nearSeal } : l))),
  },
  { name: 'stage', key: 'camp.next.stage', edit: (c) => (c.xp = { total: 1150, floor: 100, next: 1200 }) },
  { name: 'shop', key: 'camp.next.shop', edit: (c) => (c.affordable = 2) },
  { name: 'scrolls', key: 'camp.next.scrolls', edit: (c) => (c.oracle = { ...c.oracle, status: 'sealed' }) },
  { name: 'weekly', key: 'camp.next.weekly', vars: { texts: 'deux textes' }, edit: (c) => (c.weekly = { ...c.weekly, target: 3, done: 1, reached: false }) },
  { name: 'none', key: 'camp.next.none', edit: () => {} },
];

/** Walks the greeting to its what-next line, collecting what the dragon said on the way. */
async function toNextLine(page: Page): Promise<string[]> {
  const box = page.getByTestId('dialogue-box');
  await expect(box).toBeVisible();
  const said: string[] = [];
  for (let i = 0; i < 6 && !((await box.getAttribute('data-key')) ?? '').startsWith('camp.next.'); i++) {
    said.push((await page.getByTestId('dialogue-text').textContent()) ?? '');
    await nextLine(page);
  }
  return said;
}

for (const c of CASES) {
  test(`the dragon names the next goal: ${c.name}`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    // The seeded hatchling was already seen: no hatching reveal stands in front of the greeting.
    expect((await request.patch(`/api/profiles/${id}`, { data: { settings: { dragon_seen_stage: 'hatchling' } } })).ok()).toBeTruthy();
    await page.route(`**/api/profiles/${id}/camp`, async (route) => {
      const camp = await (await route.fetch()).json();
      calm(camp);
      c.edit(camp);
      await route.fulfill({ json: camp });
    });
    await page.goto(`/#/p/${id}/camp`);
    await expectCamp(page);
    const before = await toNextLine(page);
    await expectLineOf(page.getByTestId('dialogue-box'), c.key, c.vars);
    // R7: the stage line is left out when the next goal is the name or the stage.
    if (c.name === 'stage' || c.name === 'name') expect(before).toHaveLength(2); // camp.enter, camp.weekly
  });
}
