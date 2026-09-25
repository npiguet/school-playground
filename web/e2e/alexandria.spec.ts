import { test, expect } from './crashGuard';
import type { Locator } from '@playwright/test';
import { closeOverlay, createProfile, expectNoOverlap, uniqueName, watchOverlap } from './helpers';

// "Vingt mille lieues" only has one offline fixture page, so its whole online library
// (server/app/alexandria) is a finite, server-wide pool of 7 clean chunks - not per-profile, by
// design (service.py: a chunk's adoption link is shared and survives a refresh, so the same passage
// is never offered twice, to anyone). Every run of this spec adopts one of them, so concurrent runs
// (`--repeat-each`, any number of workers) compete for that pool. The spec stays correct for ANY
// worker count by *claiming* a chunk instead of assuming one is free (fix round 4 - round 3 spread
// runs over `parallelIndex % 7`, which only held up to 7 concurrent workers):
// - Claim: try the unadopted cards in turn (starting at `parallelIndex` to spread concurrent runs
//   out); the server's adopt is an atomic check-then-create (service.adopt_chunk, under SQLite's
//   write lock), so exactly one run gets 201 "created" for a chunk - that run owns the text. A 200
//   means another run owns it: leave it alone and try the next card. If every card is held, reload
//   the list and try again (bounded `toPass`): holders release theirs within seconds. The loop
//   only starts once this run's own refresh has finished reloading the list, and waits for each
//   adopt to settle in the UI before the next click (see the comments inline).
// - Release: the owner deletes its text in `finally` (DELETE /api/texts/{id}; the
//   online_chunk.text_id foreign key's ON DELETE SET NULL frees the chunk again), so the pool
//   never runs dry. Only the 201 owner ever deletes, and no other run ever plays a text it got a
//   200 for, so a release can never pull a text out from under another run (the round-3 repro of
//   that was "Impossible de charger ce parchemin : Text not found").
// Time budget (fix round 5): the waits below used to claim up to 120 s under a 60 s test timeout,
// so they could never apply. Sized to the worst case instead, each inner wait under this total:
// profile + navigation (~15 s under load) + the failing Daudet refresh (30 s) + the Verne refresh
// and its list reload (45 s) + the claim loop (45 s) + adopt/play (~15 s) = 150 s. Refreshes merge
// per work and fetch independently of other works (app/alexandria/flights.py, fix round 6): a
// refresh of a given work waits at most for another refresh of that *same* work already in flight
// - a different work's refresh runs concurrently instead of queueing behind it.
const DAUDET_REFRESH_MS = 30_000;
const VERNE_REFRESH_MS = 45_000;
const CLAIM_MS = 45_000;
test.setTimeout(150_000);

test('Alexandria: refresh from offline fixtures, graceful failure, adopt a scroll', async ({ page, request }, testInfo) => {
  let adoptedTextId: string | null = null;
  let bodyPassed = false;
  try {
    await createProfile(page, uniqueName('Alex'), '9H');
    await closeOverlay(page);
    await page.getByTestId('library-portal').click();
    await expect(page.getByRole('heading', { name: "Le portail d'Alexandrie" })).toBeVisible();
    // Pre-existing flake, found while stress-testing this spec (fix round 3): a bare `.count()` is
    // a one-shot DOM read, not an auto-retrying assertion - under a loaded shared server, the
    // works list's own fetch (a second, separate round trip from the one the heading above waits
    // on) can still be in flight, reading 0 work-cards. `expect.poll` retries the read instead.
    await expect.poll(() => page.getByTestId('work-card').count()).toBeGreaterThanOrEqual(10);
    // a work without fixtures fails gracefully
    await page.locator('[data-testid="work-card"]', { hasText: 'Lettres de mon moulin' }).click();
    await page.getByTestId('btn-refresh-work').click();
    await expect(page.getByTestId('alexandria-error')).toContainText("hors d'atteinte", { timeout: DAUDET_REFRESH_MS });
    await page.goBack();
    // the Verne work has one fixture page
    await page.locator('[data-testid="work-card"]', { hasText: 'Vingt mille lieues' }).click();
    // Wait for the refresh *and* the chunk list reload it ends with, not just for a first card:
    // earlier runs already cached this work's chunks, so cards show up at once while the refresh
    // is still running - and its closing reload swaps the whole list out (a loading line in place
    // of the cards) under the claim loop below.
    let refreshAnswered = false;
    const listReloaded = page.waitForResponse((r) => {
      const path = new URL(r.url()).pathname;
      if (r.request().method() === 'POST' && path.endsWith('/works/verne-vingt-mille-lieues/refresh')) refreshAnswered = true;
      return refreshAnswered && r.request().method() === 'GET' && path.endsWith('/works/verne-vingt-mille-lieues/chunks');
    }, { timeout: VERNE_REFRESH_MS });
    await page.getByTestId('btn-refresh-work').click();
    await listReloaded;
    await expect(page.getByTestId('chunk-card').first()).toBeVisible();
    await expect(page.getByTestId('chunk-card').first()).toContainText(/Rouleau \d+/);
    await expect(page.getByTestId('overlay-portal-work')).toBeVisible();
    const chunkCards = page.getByTestId('chunk-card');
    let target = null as Locator | null; // `as`: assigned in the toPass closure, keep TS from narrowing it to null
    let unexpectedStatus = null as number | null;
    await expect(async () => {
      const total = await chunkCards.count();
      expect(total).toBeGreaterThan(0);
      for (let k = 0; k < total; k++) {
        const card = chunkCards.nth((testInfo.parallelIndex + k) % total);
        const adoptButton = card.getByTestId('btn-adopt');
        if (!(await adoptButton.isVisible())) continue;
        const [adoptResponse] = await Promise.all([
          page.waitForResponse((r) => /\/api\/alexandria\/chunks\/\d+\/adopt$/.test(r.url()) && r.request().method() === 'POST'),
          adoptButton.click(),
        ]);
        if (adoptResponse.status() === 201) {
          adoptedTextId = String((await adoptResponse.json()).id);
          target = card;
          return;
        }
        if (adoptResponse.status() !== 200) {
          unexpectedStatus = adoptResponse.status(); // a real failure: stop retrying, fail below
          return;
        }
        // Let the screen finish this adopt before the next click: the response reaches Playwright
        // before the app's adopt() has run its `finally` (adoptingId = null), and a click in
        // between is dropped by its one-at-a-time guard - no request, and the waitForResponse
        // above would then wait forever.
        await expect(card.getByText('Le rouleau est sur tes étagères.')).toBeVisible();
      }
      await page.reload();
      throw new Error('every chunk is held by another run: waiting for one to be released');
    }).toPass({ timeout: CLAIM_MS });
    expect(unexpectedStatus).toBeNull();
    if (!target) throw new Error('no chunk claimed');
    await expect(target.getByText('Le rouleau est sur tes étagères.')).toBeVisible();
    // Fix round 1 #1 guard (Task 11 review), tightened in fix round 2 finding 2: proves Overlay's
    // OUT transition is local, not `|global` - leaving the work overlay for /play (an ancestor
    // unmount: the whole library place, LibraryTent included, unmounts for the play place) must
    // drop `scene-library` at once rather than lingering for its 160ms fade. Before the fix, the
    // still-fading overlay's own credits line coexisted with Play's own, and a bare
    // `getByText(/Jules Verne/)` a few lines down hit Playwright's strict mode on two matches
    // (found stress-testing this spec with --repeat-each=20 --workers=8, 20/20 failing). A fixed
    // "count 0 within 100ms" window depends on load: `watchOverlap` instead watches every DOM
    // mutation from before the click, so it catches the coexistence no matter how briefly it
    // lasted, on any machine (`topbar-camp` is Play's own TopBar, rendered from its first paint,
    // before its own text fetch resolves).
    await watchOverlap(page, 'scene-library', 'topbar-camp');
    await target.getByTestId('btn-adopt-play').click();
    await expect(page.getByTestId('topbar-camp')).toBeVisible();
    await expect(page.getByTestId('scene-library')).toHaveCount(0);
    await expect(page.getByTestId('overlay-portal-work')).toHaveCount(0);
    await expectNoOverlap(page);
    await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
    await expect(page.getByText(/Jules Verne/)).toBeVisible();
    bodyPassed = true;
  } finally {
    // Only the run whose adopt created the text (201) releases it. The release is asserted only
    // when the body passed: after a failure it is still attempted, best effort, but must not
    // replace the original error with its own.
    if (adoptedTextId) {
      const path = `/api/texts/${adoptedTextId}`;
      if (bodyPassed) {
        const released = await request.delete(path);
        expect(released.status(), await released.text()).toBe(204);
      } else {
        await request.delete(path).catch(() => undefined);
      }
    }
  }
});
