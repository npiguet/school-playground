import { test, expect } from './crashGuard';
import { createProfileApi, expectCamp, expectLineOf, expectScene, heroNamer, nextLine, tap } from './helpers';

// UI5 (spec §8): the places' greetings and the owl's hints come from content/dialogue, a variant at
// a time (tours off: crashGuard's default).
const heroName = heroNamer('Parole');

test("the camp greets with her name, the dragon's stage, then the next step (spec §8, Ruling E12)", async ({ page, request }, testInfo) => {
  const name = heroName(testInfo.project.name);
  const id = await createProfileApi(request, name);
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  const box = page.getByTestId('dialogue-box');
  await expectLineOf(box, 'camp.enter', { hero: name });
  await nextLine(page);
  await expect(box).not.toHaveAttribute('data-key', /./);
  await nextLine(page);
  await expectLineOf(box, 'camp.next.first-text');
});

test('the owl never says the same hint twice in a row', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await page.getByTestId('dialogue-skip').click();
  const said: string[] = [];
  for (let i = 0; i < 4; i++) {
    await tap(page.getByTestId('library-owl'), testInfo);
    await expectLineOf(page.getByTestId('dialogue-box'), 'library.owl');
    // expectLineOf waited for the whole line (the typewriter done).
    said.push((await page.getByTestId('dialogue-text').textContent())!);
    await page.getByTestId('dialogue-skip').click();
    await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
  }
  for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
});

test('Éris greets in the war tent, the Pythia at Delphi, in French typography', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-de-guerre`);
  await expectScene(page, 'war');
  await expectLineOf(page.getByTestId('dialogue-box'), 'war.enter');
  await expect(page.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'eris');
  await page.goto(`/#/p/${id}/temple`);
  await expectScene(page, 'delphi');
  await expectLineOf(page.getByTestId('dialogue-box'), 'delphi.enter.sealed');
  await expect(page.getByTestId('dialogue-advance')).toHaveAttribute('aria-label', 'Suite', { timeout: 15_000 });
  expect(await page.getByTestId('dialogue-text').textContent()).not.toMatch(/ [:;!?»]|« /);
});
