import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import { chooseLevel, closeOverlay, enterTitle, expectBattle, expectCamp, expectScene, installFastPauses, nextLine, createText, makeResult, postSession, redScan, spokenLines, swissDay, uniqueName } from './helpers';
import { dragonTint } from './dragon';

// SP3 Task 9 (spec §6.1): the full camp -> Oracle -> quest -> session -> reward loop, the first seal
// over three days driven through the `X-Discorde-Day` test-clock header (Decision 5, enabled only
// via `DISCORDE_TEST_HOOKS=1` in compose.e2e.yaml), a lost then won boss fight, the weekly goal
// and the break nudge, and a no-red/no-guilt scan. One profile, one describe.serial: each step
// depends on state the previous one left on the server (quests, seals, rewards, dragon stage).

// Every pace reads each breath group twice with a pause after each reading (the pace redesign): a boss
// dictation is >= 150 words, so without shortened pauses (helpers.ts installFastPauses) a real-time
// run would take minutes and blow past the test timeout. Tests 4 and 8 walk a short pace I dictation
// the same way.
const spokenCount = async (page: Page) => (await spokenLines(page)).length;

async function dictate(page: Page, draft: string, maxSteps = 120) {
  const ta = page.getByTestId('dictation-textarea');
  const next = page.getByTestId('btn-next');
  const finish = page.getByTestId('btn-finish-writing');
  await expect(ta).toBeVisible();
  for (let i = 0; i < maxSteps; i++) {
    if (await finish.isVisible()) break;
    if ((await next.count()) === 0) break;
    await expect(next).toBeEnabled();
    const before = await spokenCount(page);
    await next.click();
    // Final review M11 (same class as the camp spec's sleeps): wait until the tap has taken effect
    // - the next segment spoken (the recording mixer writes it down), or the dictation over - not a
    // fixed 60 ms.
    await expect.poll(async () => (await spokenCount(page)) > before || (await finish.isVisible())).toBe(true);
  }
  await expect(finish).toBeVisible({ timeout: 120_000 });
  await ta.fill(draft);
}

test.describe.serial('world: camp, Oracle, quests, the dragon hatching from XP, seals, boss', () => {
  let profileId: string;
  let textId: number;
  let oracleQuestId: number;

  // UI5 Ruling E13: the first visit is the camp tour, so this one step runs with the tours on.
  test.describe('the first visit', () => {
    test.use({ tours: true });

    test('1. camp is home', async ({ page }) => {
      // Fix round 1 #6: `Date.now() % 1e6` alone collided under `--repeat-each` elsewhere in the
      // suite (see uniqueName's own comment in helpers.ts) - same weak pattern, fixed here too.
      const name = uniqueName('Ariane');

      await page.goto('/');
      await enterTitle(page);
      await page.getByRole('button', { name: /Nouveau héros/ }).click();
      const ritual = page.getByTestId('overlay-hero-new');
      await ritual.getByLabel('Ton prénom').fill(name);
      await chooseLevel(ritual, '10H');
      await ritual.getByRole('button', { name: 'Accrocher mon bouclier' }).click();
      await expectCamp(page);

      // First visit: walk the camp tour (it replaced the Muses' cards, spec decision 22) instead of
      // skipping it, so this spec also exercises the full flow once: « Suite » until it is gone.
      const tour = page.getByTestId('tour');
      await expect(tour).toHaveAttribute('data-tour', 'camp');
      for (let i = 0; i < 30 && (await tour.count()) > 0; i++) {
        const step = await tour.getAttribute('data-step');
        await nextLine(page);
        await expect.poll(async () => ((await tour.count()) === 0 ? 'gone' : await tour.getAttribute('data-step'))).not.toBe(step);
      }
      await expect(tour).toHaveCount(0);

      await expect(page.getByTestId('hud-xp')).toContainText('Œuf · 0 XP');
      await expect(page.getByTestId('camp-dragon-layer').locator('img.dragon-base')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');
      await expect(page.getByTestId('camp-weekly')).toContainText('0 / 3');

      const match = page.url().match(/\/p\/(\d+)\//);
      expect(match).not.toBeNull();
      profileId = match![1];
    });
  });

  test('2. Oracle: sealed scrolls, reward known, choose the school scroll', async ({ page }) => {
    await page.goto(`/#/p/${profileId}/camp`);
    await expectCamp(page); // settled: never click into the zoom-in
    await page.getByTestId('camp-oracle').click();
    // UI3a Task 12: the camp's oracle path now leads to the Delphi temple scene itself (like the
    // library tent), not straight into the Oracle overlay - the Pythia opens that.
    await expectScene(page, 'delphi');
    await page.getByTestId('delphi-pythia').click();

    // Three sealed scrolls, each with its own opener; the reward is shown before any is opened
    // (ethics: no gamble - spec §1, plan decision 9).
    await expect(page.getByTestId('scroll-open')).toHaveCount(3);
    await expect(page.getByTestId('oracle-reward')).toContainText('Teinte Écume');
    await expect(page.getByTestId('oracle-reward').locator('[data-reward="tint:ecume"] .swatch')).toBeVisible();

    await page.getByTestId('scroll-ecole').getByTestId('scroll-open').click();
    await page.getByTestId('oracle-monster-hydre').click();
    await page.getByTestId('oracle-confirm').click();

    const oracleQuestSection = page.getByTestId('oracle-quest');
    await expect(oracleQuestSection).toContainText(/Oracle\u202f: l.Hydre/i);
    await expect(oracleQuestSection).toContainText('0 / 3 textes');

    const cardTestId = await oracleQuestSection.locator('[data-testid^="quest-card-"]').getAttribute('data-testid');
    expect(cardTestId).not.toBeNull();
    oracleQuestId = Number(cardTestId!.replace('quest-card-', ''));
    expect(oracleQuestId).toBeGreaterThan(0);

    // The choice is server state, not client state: it survives a reload, and no scroll can be
    // opened a second time this week.
    await page.reload();
    await expect(page.getByTestId('scroll-open')).toHaveCount(0);
    await expect(page.getByTestId('oracle-quest')).toContainText(/Oracle\u202f: l.Hydre/i);
  });

  test('3. quest board shows it, lieutenant page gauges', async ({ page }) => {
    await page.goto(`/#/p/${profileId}/camp`);
    await expectCamp(page);
    // UI3 Ruling B3: the quest wall lives in Delphi now; the hub's oracle path leads there.
    await page.getByTestId('camp-oracle').click();
    await expectScene(page, 'delphi');
    await page.getByTestId('delphi-tablets').click();

    await expect(page.getByTestId(`quest-card-${oracleQuestId}`)).toContainText('Récompense connue\u202f: 150 XP · Teinte Écume');

    // Two board quests can run alongside the (non-board) Oracle quest; a third is refused.
    await page.getByTestId('board-challenge-echo').getByRole('button', { name: /^Défier / }).click();
    await expect(page.getByTestId('board-challenge-echo')).toContainText('Quête en cours');
    await expect(page.getByTestId('board-challenge-echo').locator('img[src="/art/icons/lt-echo.webp"]')).toBeVisible();

    await page.getByTestId('board-challenge-chimere').getByRole('button', { name: /^Défier / }).click();
    await expect(page.getByTestId('board-challenge-chimere')).toContainText('Quête en cours');

    await page.getByTestId('board-challenge-protee').getByRole('button', { name: /^Défier / }).click();
    await expect(page.getByRole('alert')).toContainText('Deux quêtes à la fois');

    await page.goto(`/#/p/${profileId}/monstres/hydre`);
    await expect(page.getByTestId('lieutenant-gauge-days')).toContainText('0 sur 3');
    await expect(page.getByTestId('lieutenant-quest')).toBeDisabled();
    await expect(page.getByTestId('lieutenant-quest')).toContainText('Quête en cours');
  });

  test('4. a real session counts for the quest and shows the reveal', async ({ page, request }) => {
    const text = await createText(request, {
      title: uniqueName('Les fées'),
      body: 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.',
      level: '10H',
    });
    textId = text.id;

    await installFastPauses(page);
    await page.goto(`/#/p/${profileId}/play/${textId}?quest=${oracleQuestId}&encounter=hydre`);
    await expect(page.getByTestId('play-quest-banner')).toBeVisible();

    await page.getByTestId('pace-option-1').click();
    await page.getByRole('button', { name: 'Commencer la dictée' }).click();
    const ta = page.getByTestId('dictation-textarea');
    await expect(page.getByTestId('btn-next')).toBeEnabled();
    await ta.fill('Les fées danse dans la clairière.');
    await page.getByTestId('btn-next').click();
    await expect(page.getByTestId('btn-finish-writing')).toBeVisible();
    await ta.fill('Les fées danse dans la clairière. Elles chante et les oiseaux les écoutent.');
    await page.getByTestId('btn-finish-writing').click();

    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-phase', 'proofreading');
    const danse = page.locator('[data-testid^="tok-"]', { hasText: /^danse$/ });
    await danse.click();
    await page.getByTestId('word-editor').fill('dansent');
    await page.getByTestId('word-editor').press('Enter');
    await page.getByTestId('btn-done-proofreading').click();
    // Wait for whichever comes, the confirm or the victory, never sample it once (final review M16).
    const confirm = page.getByRole('button', { name: 'Oui, valider' });
    await expect(confirm.or(page.getByTestId('victory-title'))).toBeVisible();
    if (await confirm.isVisible()) await confirm.click();

    await expect(page.getByTestId('reveal-xp')).toBeVisible();
    await expect(page.getByTestId('reveal-xp')).toContainText(/\+\d+ XP/);
    await expect(page.getByTestId(`reveal-quest-${oracleQuestId}`)).toContainText('Ce texte compte\u202f: 1 / 3');
    await page.getByTestId('reveal-continue').click();
    await expect(page.getByTestId('results-catch-rate')).toBeVisible();
  });

  test('5. complete the Oracle quest via API, see the tint unlocked', async ({ page, request }) => {
    const today = swissDay();
    // The Oracle quest counts sessions, not distinct days - two more today's-dated sessions on
    // top of step 4's finish it (goal: 3).
    const res1 = await postSession(request, {
      profileId: Number(profileId),
      textId,
      day: today,
      result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }),
    });
    const res2 = await postSession(request, {
      profileId: Number(profileId),
      textId,
      day: today,
      result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }),
    });
    const oracleProgress = res2.progression.quests.find((q: { id: number }) => q.id === oracleQuestId);
    expect(oracleProgress?.completed).toBe(true);
    // Spec 2026-09-29 dragon growth §1: the dragon hatches from XP, at 100. Step 4's short text and the
    // first session here stay under it; the second (with the Oracle's 150 and the week's 40) crosses it.
    expect(res1.progression.dragon.stage_after).toBe('egg');
    expect(res2.progression.xp.total_before).toBeLessThan(100);
    expect(res2.progression.xp.total_after).toBeGreaterThanOrEqual(100);
    expect(res2.progression.dragon).toEqual({ stage_before: 'egg', stage_after: 'hatchling', needs_name: true });
    expect(res2.progression.rewards.some((r: { id: string }) => r.id === 'tint:ecume')).toBe(true);
    // Spec 2026-09-29 drachmes §1: the session pays a tenth of its XP, halves up; the purse adds each
    // session's drachmes (step 4's session paid some before these two).
    expect(res1.progression.drachmes.parts[0]).toEqual({ reason: 'session', amount: Math.floor((2 * res1.progression.xp.session + 10) / 20) });
    expect(res1.progression.drachmes.balance).toBeGreaterThan(res1.progression.drachmes.earned);
    expect(res2.progression.drachmes.balance).toBe(res1.progression.drachmes.balance + res2.progression.drachmes.earned);
    expect(res2.progression.drachmes.parts).toContainEqual({ reason: 'oracle', amount: 15 });

    await page.goto(`/#/p/${profileId}/dragon?panel=soin`);
    await expect(page.getByTestId('dragon-tint-ecume')).toBeEnabled();
    await page.getByTestId('dragon-tint-ecume').click();
    // The tint is OKLCH, painted once on a canvas (user, 2026-10-02), or by the living dragon's shader.
    await expect.poll(() => dragonTint(page.getByTestId('nest-dragon-layer'))).toBe('ecume');

    await page.goto(`/#/p/${profileId}/cabane?panel=tresors`);
    await expect(page.getByTestId('cabin-reward-tint:ecume')).toHaveAttribute('data-owned', 'true');
  });

  test('6. three days of guard win the Hydra\'s wooden seal (its trophy, 100 XP); naming the dragon; the dossier changes voice', async ({ page, request }) => {
    // Spec 2026-09-29 lieutenant levels §1: the first seal asks 3 days with a chance, 12 chances and 85 %
    // right in the handed-in copy. This hero already met the Hydra today (steps 4-5), so the seal may
    // come before the third of these days: find the response that brings it.
    let sealed: any = null;
    for (const day of ['2026-09-21', '2026-09-22', '2026-09-23']) {
      const res = await postSession(request, {
        profileId: Number(profileId),
        textId,
        day,
        result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }),
      });
      if (res.progression.levels.some((u: { lieutenant: string }) => u.lieutenant === 'hydre')) {
        sealed = res;
        break;
      }
    }
    expect(sealed).not.toBeNull();
    expect(sealed.progression.levels).toContainEqual({ lieutenant: 'hydre', level: 1, reward_id: 'trophy:hydre:1' });
    expect(sealed.progression.xp.bonuses).toContainEqual({ reason: 'level', amount: 100, lieutenant: 'hydre', level: 1 });
    expect(sealed.progression.rewards).toContainEqual({ id: 'trophy:hydre:1', kind: 'trophy', name: "Écaille de l'Hydre en bois" });
    // A seal does not grow the dragon by itself (dragon growth §1): it hatched from XP in step 5.
    expect(sealed.progression.dragon).toEqual({ stage_before: 'hatchling', stage_after: 'hatchling', needs_name: true });

    await page.goto(`/#/p/${profileId}/dragon`);
    await expect(page.getByTestId('dragon-stage')).toContainText('Dragonnet');
    await page.goto(`/#/p/${profileId}/dragon?panel=soin`);
    await page.getByTestId('dragon-name-input').fill('Braise');
    await page.getByTestId('dragon-name-save').click();
    // Final review I4: the PATCH has landed before the reload (a click resolves on dispatch).
    await expect(page.getByTestId('overlay-care').getByRole('status')).toHaveText("C'est noté.");
    await page.reload();
    await expect(page.getByTestId('dragon-name-input')).toHaveValue('Braise');

    await page.goto(`/#/p/${profileId}/camp`);
    await expect(page.getByTestId('camp-dragon-layer').getByRole('img', { name: 'Braise', exact: true })).toBeVisible();

    await page.goto(`/#/p/${profileId}/dossier`);
    await expect(page.getByTestId('dossier-line-hydre')).toContainText('Mon Hydre porte un sceau');

    await page.goto(`/#/p/${profileId}/bestiaire/hydre`);
    await expect(page.getByText('Iolaos')).toBeVisible();
  });

  test('7. boss unlocks at two wooden seals; a lost fight loses nothing; a won fight grants the gear', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000); // a real (fast-timer) boss dictation is played below
    // Must be registered before this test's first navigation (an SPA route change afterwards
    // never re-runs init scripts) - only takes effect for the winning dictation further down.
    // `page` is a fresh fixture per test even inside describe.serial, so the fast pauses need to
    // be installed here too.
    await installFastPauses(page);
    // A guaranteed >=150-word 10H text so the boss endpoint always has a candidate, regardless
    // of what the seed happens to include.
    await createText(request, {
      title: uniqueName('Long'),
      body: Array(16).fill('Les fées dansent dans la clairière et les oiseaux les écoutent.').join(' '),
      level: '10H',
    });

    // Écho's wooden seal (spec 2026-09-29 lieutenant levels §4: fight I asks two seals of bois).
    for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) {
      await postSession(request, {
        profileId: Number(profileId),
        textId,
        day,
        result: makeResult({ draft: 4, caught: 4, category: 'homophone' }),
      });
    }

    await page.goto(`/#/p/${profileId}/camp`);
    await expectCamp(page); // settled: never click into the zoom-in
    await expect(page.getByTestId('camp-boss')).toBeVisible();
    await expect(page.getByTestId('camp-boss')).toContainText("Sandales d'Hermès");

    await page.getByTestId('camp-boss').click();
    await page.getByTestId('boss-start').click();
    await expect(page).toHaveURL(/encounter=eris/);
    await expect(page.getByTestId('play-boss-banner')).toBeVisible();

    const active = await (await request.get(`/api/profiles/${profileId}/quests?status=active`)).json();
    const bossQuest = active.find((q: { kind: string }) => q.kind === 'boss');
    expect(bossQuest).toBeTruthy();
    const bossTextId = bossQuest.goal.text_id as number;
    const today = swissDay();

    // Spec 2026-09-29 §2: the fight is judged on the copy. 6 mistakes left in 120 words lose, and
    // nothing is lost: the quest stays active.
    const lost = await postSession(request, {
      profileId: Number(profileId),
      textId: bossTextId,
      day: today,
      result: makeResult({ words: 120, draft: 6, caught: 0, left: 6, category: 'agreement:verb' }),
      questId: bossQuest.id,
      encounter: 'eris',
    });
    expect(lost.progression.boss).toEqual({ tier: 1, won: false });
    const stillActive = await (await request.get(`/api/profiles/${profileId}/quests?status=active`)).json();
    expect(stillActive.some((q: { id: number }) => q.id === bossQuest.id)).toBe(true);

    // A clean copy simply wins (no more "too easy" draw): play the boss text for real, unmodified.
    const bossBody = ((await (await request.get(`/api/texts/${bossTextId}`)).json()) as { body: string }).body;
    await page.locator('[data-testid^="pace-option-"]:not(.disabled)').first().click();
    await page.getByRole('button', { name: 'Commencer la dictée' }).click();
    await dictate(page, bossBody);
    await page.getByTestId('btn-finish-writing').click();
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-phase', 'proofreading');
    await page.getByTestId('btn-done-proofreading').click();
    const confirm = page.getByRole('button', { name: 'Oui, valider' });
    await expect(confirm.or(page.getByTestId('victory-title'))).toBeVisible();
    if (await confirm.isVisible()) await confirm.click();
    await expect(page.getByTestId('reveal-boss-reward')).toHaveText("Ta récompense\u202f: Sandales d'Hermès\u202f!", { timeout: 15_000 });
    await page.getByTestId('reveal-continue').click();

    await page.goto(`/#/p/${profileId}/cabane?panel=tresors`);
    await expect(page.getByTestId('cabin-reward-sandales_hermes')).toHaveAttribute('data-owned', 'true');
    await expect(page.getByTestId('cabin-reward-sandales_hermes').locator('img[src="/art/icons/sandales_hermes.webp"]')).toBeVisible();
    await page.getByTestId('cabin-equip-sandales_hermes').click();
    await expect(page.getByTestId('cabin-equip-sandales_hermes')).toContainText('Ranger');
    await closeOverlay(page);
    await expectScene(page, 'cabin');
    // Spec 2026-10-02 house treasures (pre-flight ruling H4): the gear put on display stands at its
    // place in the room, on the cupboard's bottom shelf.
    await expect(page.getByTestId('cabin-piece-sandales_hermes')).toBeVisible();
    await expect(page.getByTestId('cabin-piece-sandales_hermes').locator('img')).toHaveAttribute('src', '/art/treasures/sandales_hermes.webp');
  });

  test('8. weekly goal and break nudge', async ({ page }) => {
    await installFastPauses(page);
    await page.goto(`/#/p/${profileId}/camp`);
    // Steps 4-5 already posted three of today's sessions (goal: 3).
    await expect(page.getByTestId('camp-weekly')).toContainText('Objectif atteint');

    // Seeds the ~26-minute break-nudge clock via an init script (applied fresh to every future
    // navigation, including the reload below) rather than a live page.evaluate() + reload(): a
    // reload after mutating sessionStorage on an already-mounted page races the app's own
    // clockStop()/persist() calls (mount, phase changes, visibility changes), which can write the
    // page's still-zero in-memory clock back over the injected value before the reload lands -
    // this became newly flaky once the heavier Camp hub scene shifted that timing (UI1).
    await page.addInitScript(
      (seed) => sessionStorage.setItem(seed.key, seed.value),
      { key: 'discorde.playClock', value: JSON.stringify({ activeMs: 26 * 60000, running: false, lastTick: null, lastStop: Date.now() }) },
    );
    // Spec 2026-09-29 §3: Argus left at the camp (the hero's remembered aids), so « J'ai terminé »
    // validates at once, with no « passes left » confirm.
    const patched = await page.request.patch(`/api/profiles/${profileId}`, { data: { settings: { aids: ['palamede'] } } });
    expect(patched.ok()).toBeTruthy();
    await page.goto(`/#/p/${profileId}/play/${textId}`);
    await page.reload();

    // Each test has its own browser context: step 4's saved play state is not here, so this is a
    // fresh muster, never the old results.
    await expectBattle(page, 'muster');
    await expect(page.getByRole('button', { name: 'Rejouer ce texte' })).toHaveCount(0);

    await page.getByTestId('pace-option-1').click();
    await page.getByRole('button', { name: 'Commencer la dictée' }).click();
    const ta = page.getByTestId('dictation-textarea');
    await expect(page.getByTestId('btn-next')).toBeEnabled();
    await ta.fill('Les fées dansent dans la clairière.');
    await page.getByTestId('btn-next').click();
    await expect(page.getByTestId('btn-finish-writing')).toBeVisible();
    await ta.fill('Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.');
    await page.getByTestId('btn-finish-writing').click();
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-phase', 'proofreading');
    await page.getByTestId('btn-done-proofreading').click();
    await expect(page.getByRole('button', { name: 'Oui, valider' })).toHaveCount(0);

    await expect(page.getByTestId('break-nudge')).toBeVisible();
    // UI4 playability #16: the plate names Braise, who yawns in the first person.
    await expect(page.getByTestId('break-nudge')).toContainText('Braise');
    await expect(page.getByTestId('break-nudge')).toContainText('(Il bâille.)');
    await expect(page.getByTestId('break-pause')).toHaveText('On rentre souffler');
    await page.getByTestId('break-continue').click();
    await expect(page.getByTestId('break-nudge')).toHaveCount(0);
  });

  test('9. no red, no guilt', async ({ page }) => {
    await page.goto(`/#/p/${profileId}/camp`);
    await expectCamp(page);
    // Final review I8: scan the hub once /camp has rendered (HUD laurel, places, dragon greeting),
    // not the empty stage that exists before the data arrives.
    await expect(page.getByTestId('hud-xp')).toBeVisible();
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    expect(await redScan(page)).toEqual([]);
    await expect(page.locator('body')).not.toContainText(/manqué|raté|perdu/i);

    await page.goto(`/#/p/${profileId}/dossier`);
    await expect(page.getByRole('heading', { name: "Le dossier d'Éris" })).toBeVisible();
    expect(await redScan(page)).toEqual([]);
  });
});

