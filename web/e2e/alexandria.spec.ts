import { test, expect } from '@playwright/test';
import { createProfile, uniqueName } from './helpers';

// Fix round 3: "Vingt mille lieues" only has one offline fixture page, so its whole online
// library (server/app/alexandria) is a finite, server-wide pool of 7 clean chunks - not
// per-profile, by design (service.py: a chunk's adoption link is shared and survives a refresh,
// so the same passage is never offered twice, to anyone). Under `--repeat-each` with several
// workers, every run of this spec used to race for the same single highest-scored chunk
// (`btn-adopt().first()`, deterministic - every concurrent run picks the exact same one): whoever
// won left it permanently "already adopted" for every future run, and 7 permanent adoptions
// exhaust the pool, timing out `btn-adopt` forever after (verified from
// test-results/*/error-context.md: every chunk-card showed "Déjà dans les Parchemins" once the
// pool ran dry). Two changes fix this:
// 1. Spread concurrent runs across *different* chunks instead of racing for the same one:
//    `testInfo.parallelIndex` is unique among concurrently running tests (Playwright's guarantee),
//    so indexing by it picks a different chunk per concurrently-running test whenever the pool (7)
//    covers the worker count. The index is taken from `chunk-card`'s count, not `btn-adopt`'s: the
//    full chunk-card list (and its score/seq order) is stable regardless of who has adopted what,
//    while the set of *unadopted* cards shrinks and reorders live as other workers adopt/release -
//    indexing off that shrinking set let two workers converge on the same physical chunk whenever
//    their two "available count" reads landed either side of a third worker's adopt or release
//    (reproduced once even with a first attempt at this fix: see "Text not found" below).
// 2. Release the adopted text once done (DELETE /api/texts/{id}, which the online_chunk.text_id
//    foreign key's ON DELETE SET NULL then frees back to "unadopted") so a later repeat can adopt
//    it again - captured from the adopt response itself (not re-derived from the play URL later),
//    so a downstream assertion failure still leaves the pool in a clean state for the next repeat -
//    but only when this run's own POST .../adopt actually created it (201, not a 200 reuse of
//    another run's already-created text): deleting a text a concurrent run's own adopt-then-play
//    still depends on is exactly what produced "Impossible de charger ce parchemin : Text not
//    found" during this fix's own repro, so only the true creator ever deletes it.
test('Alexandria: refresh from offline fixtures, graceful failure, adopt a scroll', async ({ page, request }, testInfo) => {
  let adoptedTextId: string | null = null;
  try {
    await createProfile(page, uniqueName('Alex'), '9H');
    await page.getByTestId('btn-add-text').click();
    await page.getByTestId('menu-add-alexandria').click();
    await expect(page.getByRole('heading', { name: "Bibliothèque d'Alexandrie" })).toBeVisible();
    // Pre-existing flake, found while stress-testing this spec (fix round 3): a bare `.count()` is
    // a one-shot DOM read, not an auto-retrying assertion - under a loaded shared server, the
    // works list's own fetch (a second, separate round trip from the one the heading above waits
    // on) can still be in flight, reading 0 work-cards. `expect.poll` retries the read instead.
    await expect.poll(() => page.getByTestId('work-card').count()).toBeGreaterThanOrEqual(10);
    // a work without fixtures fails gracefully
    await page.locator('[data-testid="work-card"]', { hasText: 'Lettres de mon moulin' }).click();
    await page.getByTestId('btn-refresh-work').click();
    await expect(page.getByTestId('alexandria-error')).toContainText("hors d'atteinte", { timeout: 60_000 });
    await page.goBack();
    // the Verne work has one fixture page
    await page.locator('[data-testid="work-card"]', { hasText: 'Vingt mille lieues' }).click();
    await page.getByTestId('btn-refresh-work').click();
    await expect(page.getByTestId('chunk-card').first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId('chunk-card').first()).toContainText(/Rouleau \d+/);
    const chunkCards = page.getByTestId('chunk-card');
    const total = await chunkCards.count();
    const target = chunkCards.nth(testInfo.parallelIndex % total);
    const [adoptResponse] = await Promise.all([
      page.waitForResponse((r) => /\/api\/alexandria\/chunks\/\d+\/adopt$/.test(r.url()) && r.request().method() === 'POST'),
      target.getByTestId('btn-adopt').click(),
    ]);
    if (adoptResponse.status() === 201) adoptedTextId = String((await adoptResponse.json()).id);
    await expect(target.getByText('Rouleau ajouté aux Parchemins.')).toBeVisible();
    await target.getByTestId('btn-adopt-play').click();
    await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
    await expect(page.getByText(/Jules Verne/)).toBeVisible();
  } finally {
    // Best-effort: a run whose adopt POST got a 200 (another run already created this text) has
    // nothing of its own to release.
    if (adoptedTextId) await request.delete(`/api/texts/${adoptedTextId}`);
  }
});
