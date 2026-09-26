import { test, expect } from './crashGuard';
import { closeOverlay, createProfileApi, expectScene, redScan, uniqueName, waitForSceneSettled } from './helpers';

// UI3 feature-parity gate (scenes spec §3 "feature parity is a review gate", §2.3 "every scene and
// overlay has a route"): every route of the app, opened by a cold deep link (a fresh page per row,
// final review M19: after the first row a `goto` on the same page is only a fragment change), shows
// its place, its overlay (exactly one) and a control inside it that proves the legacy feature is
// there. desktop + ipad.

interface Row {
  hash: string;
  scene?: string;
  overlay?: string;
  testId?: string;
  label?: string;
  heading?: string;
  url?: RegExp;
  /** `testId` names one of a list (the portal's work cards). */
  many?: boolean;
}

const ROWS: Row[] = [
  { hash: '#/', scene: 'title', testId: 'title-gate' },
  { hash: '#/?panel=tous', scene: 'title', overlay: 'overlay-heroes' },
  { hash: '#/profiles/new', scene: 'title', overlay: 'overlay-hero-new', label: 'Ton prénom' },
  { hash: '#/p/{id}/camp', scene: 'camp', testId: 'camp-parchemins' },
  { hash: '#/p/{id}/camp?panel=heros', scene: 'cabin', overlay: 'overlay-heros', testId: 'hero-switch', url: /\/cabane\?panel=heros$/ },
  { hash: '#/p/{id}/tente-parchemins', scene: 'library', testId: 'library-shelves' },
  { hash: '#/p/{id}/parchemins', scene: 'library', overlay: 'overlay-shelves' },
  { hash: '#/p/{id}/texts/new', scene: 'library', overlay: 'overlay-desk', label: 'Titre' },
  { hash: '#/p/{id}/texts/scan', scene: 'library', overlay: 'overlay-lens', testId: 'scan-input' },
  { hash: '#/p/{id}/alexandria', scene: 'library', overlay: 'overlay-portal', testId: 'work-card', many: true },
  { hash: '#/p/{id}/alexandria/{work}', scene: 'library', overlay: 'overlay-portal-work', testId: 'btn-refresh-work' },
  { hash: '#/p/{id}/temple', scene: 'delphi', testId: 'delphi-pythia' },
  { hash: '#/p/{id}/delphes', scene: 'delphi', overlay: 'overlay-pythia', testId: 'oracle-reward' },
  { hash: '#/p/{id}/quetes', scene: 'delphi', overlay: 'overlay-tablets', testId: 'board-boss' },
  { hash: '#/p/{id}/tente-de-guerre', scene: 'war', testId: 'war-hydre' },
  { hash: '#/p/{id}/dossier', scene: 'war', overlay: 'overlay-dossier', testId: 'dossier-small-tricks' },
  { hash: '#/p/{id}/bestiaire', scene: 'war', overlay: 'overlay-codex', testId: 'bestiary-card-hydre' },
  { hash: '#/p/{id}/bestiaire/argus', scene: 'war', overlay: 'overlay-codex-page', heading: 'Le mythe' },
  { hash: '#/p/{id}/monstres/hydre', scene: 'war', overlay: 'overlay-portrait', testId: 'lieutenant-quest' },
  { hash: '#/p/{id}/dragon', scene: 'nest', testId: 'dragon-stage' },
  { hash: '#/p/{id}/dragon?panel=soin', scene: 'nest', overlay: 'overlay-care', testId: 'dragon-tint-bronze' },
  { hash: '#/p/{id}/cabane', scene: 'cabin', testId: 'cabin-trophies' },
  { hash: '#/p/{id}/cabane?panel=tresors', scene: 'cabin', overlay: 'overlay-trophies', testId: 'cabin-reward-egide' },
  { hash: '#/p/{id}/cabane?panel=heros', scene: 'cabin', overlay: 'overlay-heros', testId: 'hero-journal' },
  { hash: '#/p/{id}/stats', scene: 'cabin', overlay: 'overlay-journal', testId: 'journal-totals' },
  { hash: '#/p/{id}/settings', scene: 'cabin', overlay: 'overlay-lyre', label: 'Tes quatre chiffres' },
  { hash: '#/p/{id}/eris', scene: 'battle', testId: 'boss-start' },
  { hash: '#/p/{id}/play/{text}', scene: 'battle', testId: 'pace-option-1' },
];

test('every route opens its place, its overlay and its legacy feature', async ({ context, request }, testInfo) => {
  test.setTimeout(240_000);
  const id = await createProfileApi(request, uniqueName(`Parite-${testInfo.project.name}`));
  const work = ((await (await request.get('/api/alexandria/works')).json()) as { id: string }[])[0].id;
  const text = ((await (await request.get('/api/texts')).json()) as { id: number }[])[0].id;
  for (const row of ROWS) {
    const hash = row.hash.replace('{id}', String(id)).replace('{work}', work).replace('{text}', String(text));
    const page = await context.newPage();
    await page.goto(`/${hash}`);
    if (row.scene) {
      await expect(page.getByTestId(`scene-${row.scene}`), hash).toBeVisible();
      await waitForSceneSettled(page, row.scene);
    }
    if (row.url) await expect(page, hash).toHaveURL(row.url);
    // The feature is looked for inside the overlay when there is one, and must be there once.
    const scope = row.overlay ? page.getByTestId(row.overlay) : page.locator('body');
    if (row.overlay) await expect(scope, hash).toBeVisible();
    if (row.testId) {
      const feature = scope.getByTestId(row.testId);
      await expect(row.many ? feature.first() : feature, hash).toBeVisible();
    }
    if (row.label) await expect(scope.getByLabel(row.label), hash).toBeVisible();
    if (row.heading) await expect(scope.getByRole('heading', { name: row.heading }), hash).toBeVisible();
    expect(await redScan(page), hash).toEqual([]);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.close();
  }
});

// UI4 Ruling C5: the top bar retired; from a battle's muster the HUD's hero chip opens the hero panel
// in the cabin, whose medallions reach the journal and the lyre; its seal steps back to the battle.
test('the battle muster reaches the journal and the lyre through the hero panel', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`ParBat-${testInfo.project.name}`));
  const text = ((await (await request.get('/api/texts')).json()) as { id: number }[])[0].id;
  for (const hash of [`#/p/${id}/eris`, `#/p/${id}/play/${text}`]) {
    await page.goto(`/${hash}`);
    await expectScene(page, 'battle');
    await page.getByTestId('hud-hero').click();
    await expect(page.getByTestId('overlay-heros'), hash).toBeVisible();
    for (const [medallion, overlay, url] of [
      ['hero-journal', 'overlay-journal', /\/stats$/],
      ['hero-settings', 'overlay-lyre', /\/settings$/],
    ] as const) {
      await page.getByTestId(medallion).click();
      await expect(page, medallion).toHaveURL(url);
      await expect(page.getByTestId(overlay), medallion).toBeVisible();
      await closeOverlay(page);
      await expect(page.getByTestId('overlay-heros'), medallion).toBeVisible();
    }
    await closeOverlay(page);
    await expect(page, hash).toHaveURL(new RegExp(hash.replace(/[?]/g, '\\?') + '$'));
    await expectScene(page, 'battle');
    expect(await redScan(page), hash).toEqual([]);
  }
});
