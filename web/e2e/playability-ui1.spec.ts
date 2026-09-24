import { test, expect, type Page } from '@playwright/test';
import { createText, expectCamp, makeResult, postSession, redScan, skipOnboarding, stubSpeech, waitForSceneSettled } from './helpers';

// Playability walk for the UI1 review (scenes spec §10): iPad-size screenshots of the camp hub
// into docs/reviews/ui1/<project>-NN-<name>.png for the Opus playability/immersion review ("does
// anything still look like a school form?"). Landscape walks the hub; portrait only records the
// rotate screen. Run: scripts/playwright.sh --config playwright.playability.config.ts playability-ui1

const OUT = '/work/docs/reviews/ui1';

async function shot(page: Page, project: string, name: string, settleMs = 900) {
  // Longer than the 450 ms scene zoom-in and the 280 ms overlay slide.
  await page.waitForTimeout(settleMs);
  await page.screenshot({ path: `${OUT}/${project}-${name}.png` });
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

async function dismissGreeting(page: Page) {
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
}

test('UI1 playability walk', async ({ page, request }, testInfo) => {
  test.setTimeout(300_000);
  const project = testInfo.project.name;
  const notes: string[] = [];
  const origins = new Set<string>();
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
  });
  await stubSpeech(page);
  try {
    await walk();
  } finally {
    notes.push(`request origins: ${JSON.stringify([...origins])}`);
    console.log(`\n===== NOTES ${project} =====\n${notes.join('\n')}\n`);
  }
  // Final review I7 (spec §2.7, no runtime Google Fonts): every request went to the app itself.
  expect([...origins]).toEqual([new URL(String(testInfo.project.use.baseURL)).origin]);

  async function walk() {
    // ---- 01 New hero lands on the hub, onboarding on top ------------------------------------
    const name = `Ariane-${project}`;
    await page.goto('/');
    await page.getByRole('button', { name: /Nouveau héros/ }).click();
    await page.getByLabel('Ton prénom').fill(name);
    await page.getByLabel('Ton niveau').selectOption('10H');
    await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
    await expectCamp(page);
    await waitForSceneSettled(page);
    const profileId = Number(page.url().match(/#\/p\/(\d+)\//)?.[1]);
    expect(profileId).toBeGreaterThan(0);

    if (project === 'ipad-portrait') {
      await expect(page.getByTestId('rotate-screen')).toBeVisible();
      await shot(page, project, '01-rotate-screen');
      return;
    }

    await shot(page, project, '01-camp-onboarding', 1500);
    await skipOnboarding(page);

    // ---- 02-04 The dragon's greeting, then the fresh hub -------------------------------------
    const line = page.getByTestId('dialogue-text');
    await expect(line).toHaveText(`Bienvenue au camp, ${name}.`);
    await shot(page, project, '02-camp-greeting');
    await page.getByTestId('dialogue-advance').click();
    await expect(line).toHaveText(/L'œuf frémit/);
    await shot(page, project, '03-camp-greeting-2');
    // Playability #2: the greeting ends by pointing at where the texts are defended.
    await page.getByTestId('dialogue-advance').click();
    await expect(line).toHaveText("Les parchemins t'attendent, sous la tente.");
    await shot(page, project, '03b-camp-greeting-3');
    await page.getByTestId('dialogue-skip').click();
    await waitForSceneSettled(page);
    await shot(page, project, '04-camp-hub-egg');
    const boxes = await page
      .locator('.hotspot')
      .evaluateAll((els) => els.map((e) => `${e.getAttribute('data-testid')} ${JSON.stringify(e.getBoundingClientRect())}`));
    notes.push(`hotspot boxes: ${boxes.join(' | ')}`);
    // Ruling P5: only Cinzel and Alegreya are painted on the camp itself. Literata (the dictation
    // reading font, --font-reading) isn't used on this screen, so it's loaded explicitly before
    // being checked rather than asserted as a side effect of camp rendering.
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      await document.fonts.load('400 16px Literata');
      return {
        cinzel: document.fonts.check('700 16px Cinzel'),
        alegreya: document.fonts.check('400 16px Alegreya'),
        literata: document.fonts.check('400 16px Literata'),
      };
    });
    notes.push(`fonts loaded: ${JSON.stringify(fonts)}`);
    // Final review I7: asserted, not just logged.
    expect(fonts).toEqual({ cinzel: true, alegreya: true, literata: true });
    // Final review I8: the ethics scan on the rendered hub.
    expect(await redScan(page)).toEqual([]);

    // ---- 05 Keyboard focus on a place -------------------------------------------------------
    await page.getByTestId('camp-oracle').focus();
    await shot(page, project, '05-camp-focus');

    // ---- 06 Hero panel (overlay on its own route) -------------------------------------------
    await page.getByTestId('hud-hero').click();
    await expect(page.getByTestId('overlay-heros')).toBeVisible();
    await shot(page, project, '06-hero-panel');
    await page.getByTestId('overlay-close').click();

    // ---- 07-08 A lived-in camp: dragon hatched and named, a board quest, the battle path -----
    const text = await createText(request, {
      title: `Veillée ${project}`,
      body: 'Les héros reviennent au camp. Ils racontent leurs voyages et les Muses les écoutent.',
      level: '10H',
    });
    for (const day of ['2026-08-03', '2026-08-04', '2026-08-05']) {
      for (const category of ['agreement:verb', 'homophone']) {
        await postSession(request, { profileId, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category }) });
      }
    }
    expect((await request.patch(`/api/profiles/${profileId}/dragon`, { data: { name: 'Braise' } })).ok()).toBeTruthy();
    expect((await request.post(`/api/profiles/${profileId}/quests`, { data: { target: 'chimere' } })).ok()).toBeTruthy();
    await page.reload();
    await expectCamp(page);
    await waitForSceneSettled(page);
    await expect(page.getByTestId('camp-boss')).toBeVisible();
    await expect(page.getByTestId('camp-dragon')).toContainText('Braise');
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    await shot(page, project, '07-camp-hatchling-greeting');
    await dismissGreeting(page);
    await shot(page, project, '08-camp-lived-in');
    notes.push(`camp lived-in text: ${clean(await page.getByTestId('scene-camp').textContent())}`);

    // ---- 09-12 Where the places lead (legacy screens, restaged in UI3) -----------------------
    const places = ['parchemins', 'oracle', 'dossier', 'cabin'];
    for (let i = 0; i < places.length; i++) {
      await page.getByTestId(`camp-${places[i]}`).click();
      await expect(page).not.toHaveURL(/\/camp$/);
      await shot(page, project, `${String(9 + i).padStart(2, '0')}-place-${places[i]}`);
      await page.goBack();
      await expectCamp(page);
      await waitForSceneSettled(page);
    }

    // ---- 13 Reduced motion ------------------------------------------------------------------
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.getByTestId('scene-camp')).toHaveAttribute('data-reduced-motion', 'true');
    await shot(page, project, '13-camp-reduced-motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // ---- 14 Read-only hotspot debug overlay (Task 9b: replaces the dropped `?edit` editor) ---
    await page.goto(`/?debug#/p/${profileId}/camp`);
    await expectCamp(page);
    await waitForSceneSettled(page);
    await expect(page.getByTestId('hotspot-debug')).toBeVisible();
    await shot(page, project, '14-hotspot-debug');

    // ---- 14b A prophecy on the hub (final review M9, playability #16) ------------------------
    const dueIn3 = new Date(Date.now() + 3 * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
    await createText(request, {
      title: 'Les fées de la clairière',
      body: 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.',
      level: '10H',
      due_date: dueIn3,
    });
    await page.goto(`/#/p/${profileId}/camp`);
    await expectCamp(page);
    await dismissGreeting(page);
    await waitForSceneSettled(page);
    const prophecy = page.getByTestId('camp-prophecy');
    await expect(prophecy).toContainText('La Pythie a vu ton épreuve');
    await expect(prophecy).toContainText('Les fées de la clairière');
    await expect(prophecy).not.toContainText(/dictée|jour\(s\)/);
    await expect(prophecy.getByRole('button', { name: 'Réviser' })).toBeVisible();
    await shot(page, project, '14b-camp-prophecy');

    // ---- 15-16 Laptop and ultra-wide framings (last: the emulated iPad keeps a wide layout
    // viewport after these resizes, so nothing is shot at 1180x820 after them) -----------------
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForSceneSettled(page);
    await shot(page, project, '15-laptop-1440x900');
    await page.setViewportSize({ width: 2560, height: 1080 });
    await waitForSceneSettled(page);
    await shot(page, project, '16-ultrawide-2560x1080');
  }
});
