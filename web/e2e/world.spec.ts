import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import { chooseLevel, enterTitle, expectCamp, expectScene, stubSpeech, createText, makeResult, postSession, redScan, uniqueName } from './helpers';

// SP3 Task 9 (spec §6.1): the full camp -> Oracle -> quest -> session -> reward loop, a 3-day
// mastery hatch driven through the `X-Discorde-Day` test-clock header (Decision 5, enabled only
// via `DISCORDE_TEST_HOOKS=1` in compose.e2e.yaml), a lost then won boss fight, the weekly goal
// and the break nudge, and a no-red/no-guilt scan. One profile, one describe.serial: each step
// depends on state the previous one left on the server (quests, mastery, rewards, dragon stage).

// Paces 3-4 auto-advance through real setTimeout pauses (600 ms + a per-chunk pause): a boss
// dictation is >= 150 words, so without this a real-time run would take minutes and blow past the
// test timeout. Ported from playability-sp3.spec.ts (installFastTimers/dictate) - only test 7
// needs it, for the too_easy real-dictation check (P1-5 follow-up).
async function installFastTimers(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    const orig = w.setTimeout;
    w.setTimeout = function (fn: TimerHandler, ms?: number, ...args: unknown[]) {
      if (w.__fastTimers && typeof ms === 'number' && ms >= 500) ms = Math.ceil(ms / 25);
      return orig.call(w, fn, ms, ...args);
    };
  });
}

const spokenCount = (page: Page) => page.evaluate(() => ((window as any).__spoken as string[]).length);

async function dictate(page: Page, draft: string, maxSteps = 120) {
  const ta = page.getByTestId('dictation-textarea');
  const next = page.getByTestId('btn-next');
  const finish = page.getByTestId('btn-finish-writing');
  await expect(ta).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => ((window as any).__fastTimers = true));
  for (let i = 0; i < maxSteps; i++) {
    if (await finish.isVisible()) break;
    if ((await next.count()) === 0) break;
    await expect(next).toBeEnabled({ timeout: 10_000 });
    const before = await spokenCount(page);
    await next.click();
    // Final review M11 (same class as the camp spec's sleeps): wait until the tap has taken effect
    // - the next segment spoken (stubSpeech records it), or the dictation over - not a fixed 60 ms.
    await expect.poll(async () => (await spokenCount(page)) > before || (await finish.isVisible())).toBe(true);
  }
  await expect(finish).toBeVisible({ timeout: 120_000 });
  await page.evaluate(() => ((window as any).__fastTimers = false));
  await ta.fill(draft);
}

test.describe.serial('world: camp, Oracle, quests, mastery hatch, boss', () => {
  let profileId: string;
  let textId: number;
  let oracleQuestId: number;

  test('1. camp is home', async ({ page }) => {
    await stubSpeech(page);
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

    // First visit: walk the onboarding (spec decision 22) instead of skipping it, so this spec
    // also exercises the full flow once. Two "Suivant" taps reach the last card, whose button
    // then reads "Entrer au camp".
    await page.getByTestId('onboarding-next').click();
    await page.getByTestId('onboarding-next').click();
    await page.getByRole('button', { name: 'Entrer au camp' }).click();

    await expect(page.getByTestId('hud-xp')).toContainText('Recrue du camp');
    await expect(page.getByTestId('camp-dragon')).toContainText('Un œuf de dragon');
    await expect(page.getByTestId('camp-weekly')).toContainText('0 / 3');

    const match = page.url().match(/\/p\/(\d+)\//);
    expect(match).not.toBeNull();
    profileId = match![1];
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
    await expect(oracleQuestSection).toContainText(/Oracle : l.Hydre/i);
    await expect(oracleQuestSection).toContainText('0 / 3 textes');

    const cardTestId = await oracleQuestSection.locator('[data-testid^="quest-card-"]').getAttribute('data-testid');
    expect(cardTestId).not.toBeNull();
    oracleQuestId = Number(cardTestId!.replace('quest-card-', ''));
    expect(oracleQuestId).toBeGreaterThan(0);

    // The choice is server state, not client state: it survives a reload, and no scroll can be
    // opened a second time this week.
    await page.reload();
    await expect(page.getByTestId('scroll-open')).toHaveCount(0);
    await expect(page.getByTestId('oracle-quest')).toContainText(/Oracle : l.Hydre/i);
  });

  test('3. quest board shows it, lieutenant page gauges', async ({ page }) => {
    await page.goto(`/#/p/${profileId}/dossier`);
    await page.getByTestId('topbar-camp').click();
    await expectCamp(page);
    await page.getByTestId('camp-quests').click();

    await expect(page.getByTestId(`quest-card-${oracleQuestId}`)).toContainText('Récompense connue : 150 XP · Teinte Écume');

    // Two board quests can run alongside the (non-board) Oracle quest; a third is refused.
    await page.getByTestId('board-challenge-echo').getByRole('button', { name: /^Défier / }).click();
    await expect(page.getByTestId('board-challenge-echo')).toContainText('Quête en cours');
    await expect(page.getByTestId('board-challenge-echo').locator('img[src="/art/icons/lt-echo.webp"]')).toBeVisible();

    await page.getByTestId('board-challenge-chimere').getByRole('button', { name: /^Défier / }).click();
    await expect(page.getByTestId('board-challenge-chimere')).toContainText('Quête en cours');

    await page.getByTestId('board-challenge-protee').getByRole('button', { name: /^Défier / }).click();
    await expect(page.getByRole('alert')).toContainText('Deux quêtes à la fois');

    await page.goto(`/#/p/${profileId}/monstres/hydre`);
    await expect(page.getByTestId('lieutenant-gauge-days')).toContainText('0/3');
    await expect(page.getByTestId('lieutenant-quest')).toBeDisabled();
    await expect(page.getByTestId('lieutenant-quest')).toContainText('Quête en cours');
  });

  test('4. a real session counts for the quest and shows the reveal', async ({ page, request }) => {
    await stubSpeech(page);
    const text = await createText(request, {
      title: uniqueName('Les fées'),
      body: 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.',
      level: '10H',
    });
    textId = text.id;

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

    await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
    const danse = page.locator('[data-testid^="tok-"]', { hasText: /^danse$/ });
    await danse.click();
    await page.getByTestId('word-editor').fill('dansent');
    await page.getByTestId('word-editor').press('Enter');
    await page.getByTestId('btn-done-proofreading').click();
    const confirm = page.getByRole('button', { name: 'Oui, valider' });
    if (await confirm.isVisible()) await confirm.click();

    await expect(page.getByTestId('reveal-xp')).toBeVisible();
    await expect(page.getByTestId('reveal-xp')).toContainText(/\+\d+ XP/);
    await expect(page.getByTestId(`reveal-quest-${oracleQuestId}`)).toContainText('Ce texte compte : 1 / 3');
    await page.getByTestId('reveal-continue').click();
    await expect(page.getByTestId('results-catch-rate')).toBeVisible();
  });

  test('5. complete the Oracle quest via API, see the tint unlocked', async ({ page, request }) => {
    const today = new Date().toISOString().slice(0, 10);
    // The Oracle quest counts sessions, not distinct days - two more today's-dated sessions on
    // top of step 4's finish it (goal: 3).
    await postSession(request, {
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
    expect(res2.progression.rewards.some((r: { id: string }) => r.id === 'tint:ecume')).toBe(true);

    await page.goto(`/#/p/${profileId}/dragon?panel=soin`);
    await expect(page.getByTestId('dragon-tint-ecume')).toBeEnabled();
    await page.getByTestId('dragon-tint-ecume').click();
    await expect(page.getByTestId('nest-dragon-layer').locator('img')).toHaveAttribute('style', /hue-rotate\(190deg\)/);

    await page.goto(`/#/p/${profileId}/cabane`);
    await expect(page.getByTestId('cabin-reward-tint:ecume')).toHaveAttribute('data-owned', 'true');
  });

  test('6. mastery over three days hatches the dragon; the dossier changes voice', async ({ page, request }) => {
    // Decision 3's minimal recent window is computed fresh from all-time stats, so - since this
    // profile already has Hydre-category errors "today" (steps 4-5) - it can complete in fewer
    // than three of these calls; find whichever response actually neutralises her rather than
    // hard-coding which one.
    let hatched: any = null;
    for (const day of ['2026-09-21', '2026-09-22', '2026-09-23']) {
      const res = await postSession(request, {
        profileId: Number(profileId),
        textId,
        day,
        result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }),
      });
      if (res.progression.neutralised.includes('hydre')) {
        hatched = res;
        break;
      }
    }
    expect(hatched).not.toBeNull();
    expect(hatched.progression.dragon.stage_after).toBe('hatchling');
    expect(hatched.progression.dragon.needs_name).toBe(true);

    await page.goto(`/#/p/${profileId}/dragon`);
    await expect(page.getByTestId('dragon-stage')).toContainText('Dragonnet');
    await page.goto(`/#/p/${profileId}/dragon?panel=soin`);
    await page.getByTestId('dragon-name-input').fill('Braise');
    await page.getByTestId('dragon-name-save').click();
    await page.reload();
    await expect(page.getByTestId('dragon-name-input')).toHaveValue('Braise');

    await page.goto(`/#/p/${profileId}/camp`);
    await expect(page.getByTestId('camp-dragon')).toContainText('Braise');

    await page.goto(`/#/p/${profileId}/dossier`);
    await expect(page.getByTestId('dossier-line-hydre')).toContainText("L'Hydre est neutralisée");

    await page.goto(`/#/p/${profileId}/bestiaire/hydre`);
    await expect(page.getByText('Iolaos')).toBeVisible();
  });

  test('7. boss unlocks after two lieutenants; a lost fight loses nothing; a won fight grants the gear', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000); // a real (fast-timer) boss dictation is added below, P1-5 follow-up
    // Must be registered before this test's first navigation (an SPA route change afterwards
    // never re-runs init scripts) - only takes effect for the too_easy dictation further down.
    // `page` is a fresh fixture per test even inside describe.serial, so both stubs need to be
    // (re-)installed here too, exactly as test 1 does for itself.
    await stubSpeech(page);
    await installFastTimers(page);
    // A guaranteed >=150-word 10H text so the boss endpoint always has a candidate, regardless
    // of what the seed happens to include.
    await createText(request, {
      title: uniqueName('Long'),
      body: Array(16).fill('Les fées dansent dans la clairière et les oiseaux les écoutent.').join(' '),
      level: '10H',
    });

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
    const today = new Date().toISOString().slice(0, 10);

    // P1-5 follow-up (controller ruling): a perfect dictation ("nothing to catch") must not win
    // the boss - it's a draw, and "reviens avec un texte plus long" would be false (the boss text
    // is already the longest candidate). Play the boss text for real, unmodified, and check the
    // reveal's too_easy card and its exact message.
    const bossBody = ((await (await request.get(`/api/texts/${bossTextId}`)).json()) as { body: string }).body;
    await page.locator('[data-testid^="pace-option-"]:not(.disabled)').first().click();
    await page.getByRole('button', { name: 'Commencer la dictée' }).click();
    await dictate(page, bossBody);
    await page.getByTestId('btn-finish-writing').click();
    await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
    await page.getByTestId('btn-done-proofreading').click();
    const perfectConfirm = page.getByRole('button', { name: 'Oui, valider' });
    if (await perfectConfirm.isVisible()) await perfectConfirm.click();
    await expect(page.getByTestId('reveal-boss-too-easy')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('reveal-boss-too-easy')).toContainText(
      "Dictée parfaite : Éris n'a rien pu saboter ! Furieuse, elle va corrompre le parchemin elle-même. Relance le combat pour démasquer ses pièges.",
    );
    await page.getByTestId('reveal-continue').click();
    await expect(page.getByTestId('results-catch-rate')).toBeVisible();

    // Nothing lost: the quest is still active, now flagged for a Grimoire corrompu retry on the
    // same text, and the boss screen's button/label reflects it.
    const afterTooEasy = await (await request.get(`/api/profiles/${profileId}/quests?status=active`)).json();
    const bossAfterTooEasy = afterTooEasy.find((q: { kind: string }) => q.kind === 'boss');
    expect(bossAfterTooEasy.id).toBe(bossQuest.id);
    expect(bossAfterTooEasy.goal.mode).toBe('grimoire');
    await page.goto(`/#/p/${profileId}/eris`);
    await expect(page.getByTestId('boss-start')).toContainText('Relancer le combat');
    await expect(page.getByTestId('boss-reward').locator('img[src="/art/icons/sandales_hermes.webp"]')).toBeVisible();

    const lost = await postSession(request, {
      profileId: Number(profileId),
      textId: bossTextId,
      day: today,
      result: makeResult({ draft: 5, caught: 2, category: 'agreement:verb' }),
      questId: bossQuest.id,
      encounter: 'eris',
      helpStage: 2,
    });
    expect(lost.progression.boss.won).toBe(false);
    const stillActive = await (await request.get(`/api/profiles/${profileId}/quests?status=active`)).json();
    expect(stillActive.some((q: { id: number }) => q.id === bossQuest.id)).toBe(true);

    const won = await postSession(request, {
      profileId: Number(profileId),
      textId: bossTextId,
      day: today,
      result: makeResult({ draft: 5, caught: 4, category: 'agreement:verb' }),
      questId: bossQuest.id,
      encounter: 'eris',
      helpStage: 2,
    });
    expect(won.progression.boss.won).toBe(true);
    expect(won.progression.rewards.some((r: { id: string }) => r.id === 'sandales_hermes')).toBe(true);

    await page.goto(`/#/p/${profileId}/cabane`);
    await expect(page.getByTestId('cabin-reward-sandales_hermes')).toHaveAttribute('data-owned', 'true');
    await expect(page.getByTestId('cabin-reward-sandales_hermes').locator('img[src="/art/icons/sandales_hermes.webp"]')).toBeVisible();
    await page.getByTestId('cabin-equip-sandales_hermes').click();
    await expect(page.getByTestId('cabin-equip-sandales_hermes')).toContainText('Ranger');
  });

  test('8. weekly goal and break nudge', async ({ page }) => {
    await page.goto(`/#/p/${profileId}/camp`);
    // Steps 4-5 already posted three of today's sessions (goal: 3).
    await expect(page.getByTestId('camp-weekly')).toContainText('Objectif atteint');

    await stubSpeech(page);
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
    await page.goto(`/#/p/${profileId}/play/${textId}`);
    await page.reload();

    // This text was already fully played in step 4: the play screen resumes straight to its old
    // results: "Rejouer ce texte" clears that saved state and starts a fresh session.
    const replay = page.getByRole('button', { name: 'Rejouer ce texte' });
    if (await replay.isVisible()) await replay.click();

    await page.getByTestId('pace-option-1').click();
    await page.getByRole('button', { name: 'Commencer la dictée' }).click();
    const ta = page.getByTestId('dictation-textarea');
    await expect(page.getByTestId('btn-next')).toBeEnabled();
    await ta.fill('Les fées dansent dans la clairière.');
    await page.getByTestId('btn-next').click();
    await expect(page.getByTestId('btn-finish-writing')).toBeVisible();
    await ta.fill('Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.');
    await page.getByTestId('btn-finish-writing').click();
    await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
    await page.getByTestId('btn-done-proofreading').click();
    const confirm = page.getByRole('button', { name: 'Oui, valider' });
    if (await confirm.isVisible()) await confirm.click();

    await expect(page.getByTestId('break-nudge')).toBeVisible();
    await expect(page.getByTestId('break-nudge')).toContainText('Braise bâille');
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

