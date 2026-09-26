import { test, expect } from './crashGuard';
import {
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  expectOverlayTapTargets,
  LEGACY_UI,
  redScan,
  resumeSeeded,
  seedPlay,
  stubSpeech,
  tap,
  uniqueName,
} from './helpers';

// UI4 lane P (spec §5): the muster, the dictation and the proofreading on the battle stage, their
// compact layout under the simulated keyboard, and the long text's legibility.
const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';

test.beforeEach(async ({ page }) => stubSpeech(page));

test('the muster is an order of battle: Éris taunts, four pace medallions, no school metadata', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Muster'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=hydre`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByTestId('battle-voice')).toHaveAttribute('data-speaker', 'eris');
  await expect(sheet.getByTestId('battle-voice')).toContainText('Hydre');
  await expect(sheet.getByTestId('muster-words')).toHaveText('13 mots');
  await expect(sheet).not.toContainText(/\b\d{1,2}H\b|≈/);
  await expect(sheet.getByRole('radio')).toHaveCount(4);
  await expect(sheet.getByTestId('pace-option-3')).toContainText("D'un bon pas");
  await expect(sheet.getByTestId('pace-option-4')).toContainText("D'une traite");
  await expect(sheet.getByText('Plus le rythme est vif, plus la gloire est grande.')).toBeVisible();
  await expect(sheet.locator(LEGACY_UI)).toHaveCount(0);
  await expectOverlayTapTargets(page, 'battle-parchment');
  expect(await redScan(page)).toEqual([]);
  await tap(sheet.getByTestId('pace-option-2'), testInfo);
  await expect(sheet.getByTestId('pace-option-2').locator('input')).toBeChecked();
  await tap(sheet.getByRole('button', { name: 'Commencer la dictée' }), testInfo);
  await expectBattle(page, 'dictation');
});

test('a boss dictation locks the slower paces and says why', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus2-${testInfo.project.name}`), '10H');
  const text = await createText(request, { title: uniqueName('Muster boss'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=eris&quest=1`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByTestId('play-boss-banner')).toHaveText("Combat contre Éris : les Yeux d'Argus restent éteints.");
  await expect(sheet.getByTestId('play-quest-banner')).toHaveText('Ce texte compte pour ta quête.');
  await expect(sheet.locator('[data-testid^="pace-option-"].disabled').first()).toContainText('Pas pendant un combat');
});

test('a seeded dictation comes back behind the resume ribbon', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus3-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Muster reprise'), body: BODY, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'dictation', draft: 'Les fées' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-resume')).toContainText("Ton brouillon t'attend là où tu l'avais laissé.");
  await resumeSeeded(page);
  await expectBattle(page, 'dictation');
  await expect(page.getByTestId('dictation-textarea')).toHaveValue('Les fées');
});

// Task 2 fix round 1 #3: a free text's opponent comes from this visit's own /camp answer, never from
// the snapshot the camp left in memory (a lieutenant may have woken or been neutralised since). The
// camp's snapshot here offers Protée only; the fresh answer, held back, offers Léthé only.
test('a free text waits for the fresh camp before choosing its opponent', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus5-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Camp frais'), body: BODY, level: '10H' });
  let only = 'protee';
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let held = false;
  let served = 0;
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    const pick = only;
    for (const l of json.lieutenants) {
      l.available = l.key === pick;
      l.stirring = l.key === pick;
      l.neutralised = false;
    }
    if (pick === 'lethe') {
      held = true;
      await gate;
    }
    await route.fulfill({ response: res, json });
    served += 1;
  });
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect.poll(() => served, 'the camp holds its (stale) snapshot').toBeGreaterThanOrEqual(1);
  only = 'lethe';
  await page.evaluate((hash) => (location.hash = hash), `#/p/${id}/play/${text.id}`);
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByRole('heading', { name: text.title })).toBeVisible();
  await expect.poll(() => held).toBe(true);
  // The muster is up and the fresh camp still on its way: no opponent yet, the stale one never.
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-opponent', '');
  release();
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-opponent', 'lethe');
});

test('the grimoire muster: Éris guards it, and a text too short for her says so', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus4-${testInfo.project.name}`));
  // The server takes 5 words at least; 6 tokens hold at most 2 plants 3 tokens apart (corrupt.py's
  // MIN_GAP), under the 3 Éris needs, so the corruption is always refused.
  const tiny = await createText(request, { title: uniqueName('Oui'), body: 'Oui oui oui oui oui.', level: '10H' });
  await page.goto(`/#/p/${id}/grimoire/${tiny.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByRole('heading', { name: 'Grimoire corrompu' })).toBeVisible();
  await expect(sheet.getByTestId('battle-voice')).toContainText("J'ai recopié ce parchemin à ma façon");
  await tap(sheet.getByTestId('btn-open-grimoire'), testInfo);
  await expect(sheet.locator('.kit-note[data-tone="eris"]')).toBeVisible();
  await expect(sheet.getByTestId('btn-back-library')).toHaveText('Retour aux parchemins');
});
