import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { createText, makeResult, postSession, stubSpeech } from './helpers';

// Playability walk for the SP3 review (spec §6.2): one long test per iPad orientation, every
// world/progression screen screenshotted into docs/reviews/sp3/<project>-NN-<screen>.png. Covers
// the SP3 features only (camp, onboarding, Delphes, quest board, lieutenants, dossier, bestiary,
// progression reveal, dragon, cabin, boss fight, weekly goal, break nudge, reduced motion) plus a
// short second walk as a younger sibling (6H) for tone/difficulty. Multi-day mastery is driven
// through the `X-Discorde-Day` test clock (compose.e2e.yaml enables DISCORDE_TEST_HOOKS).

const OUT = '/work/docs/reviews/sp3';

// Three short 10H texts for the UI sessions (one each so no session ever resumes another's
// saved state), and one long text (>= 150 words, the boss endpoint's floor) for the fight.
const TEXT_A = {
  title: 'Les fées de la clairière',
  body: 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.',
  // A lexical/accent slip only: no Hydre-category error, so the mastery window stays untouched
  // by this first session and the hatch can happen in the UI later.
  draft: 'Les fées dansent dans la clairiere. Elles chantent et les oiseaux les écoutent.',
  fix: ['clairiere', 'clairière'] as [string, string],
};
const TEXT_B = {
  title: 'Le retour des héros',
  body: 'Les héros reviennent au camp. Ils racontent leurs voyages et les Muses les écoutent.',
  draft: 'Les héros revienne au camp. Ils racontent leurs voyages et les Muses les écoutent.',
  fix: ['revienne', 'reviennent'] as [string, string],
};
const TEXT_C = {
  title: 'La lanterne du soir',
  body: "Le soir, les lanternes s'allument. Les jeunes héros rentrent dans leurs cabanes.",
  draft: "Le soir, les lanternes s'allument. Les jeunes héros rentrent dans leurs cabanes.",
};
const BOSS_TEXT = {
  title: 'Le Grand Désaccord',
  body:
    'Ce matin-là, les nuages couraient au-dessus du camp et les demi-dieux sentaient que quelque chose ' +
    "n'allait pas. Les parchemins de la bibliothèque, rangés avec soin la veille, étaient éparpillés sur les " +
    "tables et les mots semblaient avoir bougé pendant la nuit. Les Muses, inquiètes, réunirent les jeunes héros " +
    "devant le grand feu. « Éris est passée par ici, dit la plus âgée. Elle a touché chaque texte et ses lieutenants " +
    "ont laissé leurs traces. Les têtes de l'Hydre se cachent dans les pluriels, Écho répète des mots qui sonnent " +
    "juste, et Protée a changé la forme des participes. » Les héros écoutaient sans bouger. Ils savaient que la " +
    "déesse de la Discorde ne revenait jamais sans une idée nouvelle. Les plus courageux prirent les parchemins " +
    "abîmés et les portèrent à la lumière. Chaque phrase devait être relue, chaque accord vérifié, chaque piège " +
    "déjoué avant le coucher du soleil. Les oiseaux se taisaient. Au loin, sur la colline, une silhouette violette " +
    "observait le camp et souriait : elle attendait de voir qui oserait affronter ses ruses réunies.",
};

// Generic mistakes planted in the boss draft, whatever text the boss endpoint serves (it picks
// the longest unplayed 9H/10H text, usually a seed). Each pattern is applied once; the review
// notes which ones matched. Enough (>= 3) to make the fight losable when nothing is fixed.
// Lookarounds instead of \b: JS word boundaries are ASCII-only (« à », « écoutaient »).
const BOSS_PLANTS: { re: RegExp; to: string; kind: string }[] = [
  { re: /(?<!\p{L})(\p{L}+)aient(?!\p{L})/u, to: '$1ait', kind: 'verb -aient → -ait (Hydre)' },
  { re: /(?<!\p{L})les (\p{L}+)s(?!\p{L})/u, to: 'les $1', kind: 'plural -s dropped after « les » (Hydre)' },
  { re: /(?<!\p{L})et(?!\p{L})/u, to: 'est', kind: 'homophone et/est (Écho)' },
  { re: /(?<!\p{L})à(?!\p{L})/u, to: 'a', kind: 'homophone à/a (Écho)' },
  { re: /(?<!\p{L})ses(?!\p{L})/u, to: 'ces', kind: 'homophone ses/ces (Écho)' },
  { re: /(?<!\p{L})des (\p{L}+)s(?!\p{L})/u, to: 'des $1', kind: 'plural -s dropped after « des » (Hydre)' },
  { re: /(?<!\p{L})(\p{L}+)ée(?!\p{L})/u, to: '$1é', kind: 'feminine -ée → -é (Protée / Chimère)' },
];

// The single word that changed between a plant's original phrase and its corrupted one (some
// patterns match a short phrase, e.g. "les fées" -> "les fée", but only one word inside it
// actually differs - that's the token `editWord` needs during proofreading), and its position in
// the *matched phrase* (0 for a single-word match, 1 for "les X"/"des X").
function diffWord(before: string, after: string): { indexInMatch: number; wrong: string; correct: string } | null {
  const b = before.split(/\s+/);
  const a = after.split(/\s+/);
  for (let i = 0; i < Math.max(b.length, a.length); i++) {
    if (b[i] !== a[i]) return { indexInMatch: i, correct: b[i] ?? '', wrong: a[i] ?? '' };
  }
  return null;
}

function wordCountBefore(text: string, charIndex: number): number {
  const head = text.slice(0, charIndex).trim();
  return head ? head.split(/\s+/).length : 0;
}

// A plant's absolute word position (0-based, over the whole text split on whitespace) plus its
// wrong/correct text, so the "won" pass can locate the exact on-screen token to fix - not just
// "some token with this text", since a boss text can naturally contain the same short word
// («et», «à», «ses»…) more than once (P1-5: real proofreading must catch the RIGHT occurrence).
type BossFix = { wordIndex: number; wrong: string; correct: string };

function plantBoss(body: string): { draft: string; planted: string[]; missing: string[]; fixes: BossFix[] } {
  let draft = body;
  const planted: string[] = [];
  const missing: string[] = [];
  const fixes: BossFix[] = [];
  for (const p of BOSS_PLANTS) {
    const m = p.re.exec(draft);
    if (m) {
      const before = m[0];
      const after = before.replace(p.re, p.to);
      const diff = diffWord(before, after);
      if (diff && diff.wrong !== diff.correct) {
        fixes.push({ wordIndex: wordCountBefore(draft, m.index) + diff.indexInMatch, wrong: diff.wrong, correct: diff.correct });
      }
      draft = draft.replace(p.re, p.to);
      planted.push(p.kind);
    } else missing.push(p.kind);
  }
  return { draft, planted, missing, fixes };
}

// How many earlier words in `text` (word index < `beforeIndex`) have exactly the same text as
// `word` once punctuation is stripped - the DOM's `tok-` elements carry pure word text, so this is
// the `.nth()` a Playwright locator needs to hit the one at `beforeIndex` and not an earlier one.
function stripPunct(w: string): string {
  return w.replace(/^[«»""'’.,;:!?…()—–-]+|[«»""'’.,;:!?…()—–-]+$/g, '');
}

function occurrenceIndex(text: string, wordIndex: number): number {
  const words = text.trim().split(/\s+/).map(stripPunct);
  const target = words[wordIndex];
  return words.slice(0, wordIndex).filter((w) => w === target).length;
}

async function shot(page: Page, project: string, name: string, settleMs = 700) {
  // Longer than the 0.45 s fade-up; reveal screens pass a longer settle (cards stagger 250 ms each).
  await page.waitForTimeout(settleMs);
  await page.screenshot({ path: `${OUT}/${project}-${name}.png`, fullPage: true });
}

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tok(page: Page, word: string) {
  return page.locator('[data-testid^="tok-"]', { hasText: new RegExp(`^${esc(word)}$`) });
}

// `fromOccurrence`/`toOccurrence` pick the nth on-screen token with that exact text (0-based) -
// needed once a fix targets a common word (« et », « à », « ses »…) that may also occur naturally
// elsewhere in a long boss text (P1-5: real proofreading, on whatever text the boss endpoint
// serves). They are computed against DIFFERENT texts and so are usually different numbers: `from`
// is searched for in the corrupted draft still on screen (how many earlier "avait"s precede the
// one that used to be "avaient"), `to` is verified against the ORIGINAL text once restored (how
// many earlier "avaient"s there were - often none, even when "avait" collided four times).
async function editWord(page: Page, from: string, to: string, fromOccurrence = 0, toOccurrence = fromOccurrence) {
  await tok(page, from).nth(fromOccurrence).click();
  const editor = page.getByTestId('word-editor');
  await editor.fill(to);
  await editor.press('Enter');
  await expect(tok(page, to).nth(toOccurrence)).toBeVisible();
}

// Paces 3-4 auto-advance through real setTimeout pauses (600 ms + a per-chunk pause): while
// `__fastTimers` is set, every timer >= 500 ms is shortened 25x so a boss dictation of 170 words
// takes seconds instead of minutes. Installed before navigation, enabled only inside `dictate`.
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

// Drives the dictation runner (speech stubbed: every sentence "plays" in 20 ms) to its end -
// tapping « Suivant » at paces 1-2, letting the auto-advance run (fast timers) at paces 3-4 -
// then replaces the whole draft. `maxSteps` covers a 170-word text at any pace.
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
    await next.click();
    await page.waitForTimeout(60);
  }
  await expect(finish).toBeVisible({ timeout: 120_000 });
  await page.evaluate(() => ((window as any).__fastTimers = false));
  await ta.fill(draft);
}

// The intro's pace grid: a boss fight disables the paces below the level's default (Decision 8),
// so pick the lowest option that is still enabled rather than hard-coding pace 1.
async function pickLowestPace(page: Page): Promise<string> {
  const cards = page.locator('[data-testid^="pace-option-"]:not(.disabled)');
  const first = cards.first();
  await first.click();
  return (await first.getAttribute('data-testid')) ?? '?';
}

async function finishProofreading(page: Page) {
  await page.getByTestId('btn-done-proofreading').click();
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  if (await confirm.isVisible()) await confirm.click();
}

// Any element whose text/background/border/underline/outline colour is red-dominant (spec §1.6
// "orange rather than red"): rgb(r,g,b) with r >= 170 and g,b <= 70. Returns "tag.class: prop=value".
async function redScan(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const props = ['color', 'background-color', 'border-top-color', 'text-decoration-color', 'outline-color', 'box-shadow'];
    const out: string[] = [];
    const re = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g;
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const cs = getComputedStyle(el);
      for (const p of props) {
        const v = cs.getPropertyValue(p);
        for (const m of v.matchAll(re)) {
          const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
          const a = m[4] === undefined ? 1 : Number(m[4]);
          if (a > 0 && r >= 170 && g <= 70 && b <= 70) {
            out.push(`${el.tagName.toLowerCase()}.${(el as HTMLElement).className}: ${p}=${v}`);
          }
        }
      }
    }
    return out;
  });
}

async function imgsWithoutAlt(page: Page): Promise<number> {
  return page.locator('img:not([alt])').count();
}

// Touch targets: every visible button/link/input smaller than 44 px in either dimension.
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('button, a[href], input, select, label.card'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 44 || r.height < 44) {
        const text = ((el as HTMLElement).innerText || (el as HTMLElement).getAttribute('aria-label') || '').trim().slice(0, 30);
        out.push(`${el.tagName.toLowerCase()}[${Math.round(r.width)}x${Math.round(r.height)}] ${text}`);
      }
    }
    return out;
  });
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

async function texts(page: Page, selector: string): Promise<string[]> {
  return (await page.locator(selector).allTextContents()).map(clean);
}

async function createProfileUi(page: Page, name: string, level: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /Nouveau héros/ }).click();
  await page.getByLabel('Ton prénom').fill(name);
  await page.getByLabel('Ton niveau').selectOption(level);
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expect(page.getByRole('heading', { name: /Bienvenue au camp/ })).toBeVisible();
}

// Per-screen art accounting: bytes transferred for /art/* on the current page since the last
// reset (WebKit's memory cache means a file re-used on a later screen costs 0 there).
function artMeter(page: Page) {
  const seen = new Map<string, number>();
  let current: { screen: string; bytes: number; files: string[] } = { screen: 'start', bytes: 0, files: [] };
  const log: string[] = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (!/\/art\//.test(url)) return;
    let n = Number(res.headers()['content-length'] ?? 0);
    if (!n) {
      try {
        n = (await res.body()).length;
      } catch {
        n = 0;
      }
    }
    const file = url.replace(/^.*\/art\//, '');
    seen.set(file, n);
    current.bytes += n;
    current.files.push(`${file} ${(n / 1024).toFixed(0)}K`);
  });
  return {
    start(screen: string) {
      if (current.bytes > 0 || current.files.length > 0) {
        log.push(`art on ${current.screen}: ${(current.bytes / 1024).toFixed(0)} KB (${current.files.join(', ')})`);
      }
      current = { screen, bytes: 0, files: [] };
    },
    finish(): string[] {
      this.start('end');
      const total = [...seen.values()].reduce((a, b) => a + b, 0);
      log.push(`art files fetched over the walk: ${seen.size}, ${(total / 1024).toFixed(0)} KB total`);
      return log;
    },
  };
}

test('SP3 playability walk', async ({ page, request }, testInfo) => {
  test.setTimeout(900_000);
  const project = testInfo.project.name;
  const notes: string[] = [];
  const origins = new Set<string>();
  page.on('request', (req) => {
    try {
      origins.add(new URL(req.url()).origin);
    } catch {
      // data: URLs etc.
    }
  });
  const art = artMeter(page);
  await stubSpeech(page);
  await installFastTimers(page);
  try {
    await walk();
  } finally {
    notes.push(...art.finish());
    notes.push(`request origins: ${JSON.stringify([...origins])}`);
    console.log(`\n===== NOTES ${project} =====\n${notes.join('\n')}\n`);
  }

  async function walk() {

  // ---- 01-03 Profile → onboarding → camp ----------------------------------------------------
  art.start('camp (first visit)');
  const name = `Ariane-${project}`;
  await createProfileUi(page, name, '10H');
  const profileId = Number(page.url().match(/#\/p\/(\d+)\//)?.[1]);
  expect(profileId).toBeGreaterThan(0);
  await expect(page.getByRole('dialog', { name: 'Bienvenue au camp' })).toBeVisible();
  notes.push(`onboarding 1: ${clean(await page.getByRole('dialog').textContent())}`);
  await shot(page, project, '01-camp-onboarding-1', 1500);
  await page.getByTestId('onboarding-next').click();
  notes.push(`onboarding 2: ${clean(await page.getByRole('dialog').textContent())}`);
  await page.getByTestId('onboarding-next').click();
  notes.push(`onboarding 3: ${clean(await page.getByRole('dialog').textContent())}`);
  await shot(page, project, '02-camp-onboarding-3');
  await page.getByRole('button', { name: 'Entrer au camp' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('camp-xp')).toContainText('Recrue du camp');
  await expect(page.getByTestId('camp-dragon')).toContainText('Un œuf de dragon');
  notes.push(`camp fresh: ${clean(await page.locator('.camp').textContent())}`);
  notes.push(`camp scene box: ${JSON.stringify(await page.locator('.camp .scene').boundingBox())}`);
  notes.push(`camp dragon card box: ${JSON.stringify(await page.getByTestId('camp-dragon').boundingBox())}`);
  await shot(page, project, '03-camp-egg');
  notes.push(`red scan (camp): ${JSON.stringify(await redScan(page))}`);
  notes.push(`imgs without alt (camp): ${await imgsWithoutAlt(page)}`);
  notes.push(`small targets (camp): ${JSON.stringify(await smallTargets(page))}`);
  // Mute toggle: aria-pressed must follow the state.
  const mute = page.getByTestId('topbar-mute');
  const pressedBefore = await mute.getAttribute('aria-pressed');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', pressedBefore === 'true' ? 'false' : 'true');
  const pressedAfter = await mute.getAttribute('aria-pressed');
  await mute.click();
  notes.push(`topbar-mute aria-pressed: before=${pressedBefore} after toggle=${pressedAfter} (then toggled back)`);

  // ---- 04-06 Delphes ------------------------------------------------------------------------
  art.start('delphes');
  await page.getByTestId('camp-oracle').click();
  await expect(page.getByTestId('scroll-open')).toHaveCount(3);
  notes.push(`oracle reward line: ${clean(await page.getByTestId('oracle-reward').textContent())}`);
  notes.push(`scrolls sealed: ${JSON.stringify(await texts(page, '.scroll'))}`);
  await shot(page, project, '04-delphes-sealed');
  notes.push(`red scan (delphes): ${JSON.stringify(await redScan(page))}`);
  await page.getByTestId('scroll-ecole').getByTestId('scroll-open').click();
  await expect(page.getByTestId('oracle-monster-hydre')).toBeVisible();
  notes.push(`école picker chips: ${JSON.stringify(await texts(page, '.picker-grid .chip'))}`);
  notes.push(`école confirm (nothing chosen): ${clean(await page.getByTestId('oracle-confirm').textContent())} disabled=${await page.getByTestId('oracle-confirm').isDisabled()}`);
  await page.getByTestId('oracle-monster-hydre').click();
  notes.push(`école confirm (Hydre chosen): ${clean(await page.getByTestId('oracle-confirm').textContent())}`);
  await shot(page, project, '05-delphes-picker');
  await page.getByTestId('oracle-confirm').click();
  await expect(page.getByTestId('oracle-quest')).toContainText(/Oracle : l.Hydre/i);
  notes.push(`oracle after choice: ${JSON.stringify(await texts(page, '.scroll'))}`);
  notes.push(`oracle quest section: ${clean(await page.getByTestId('oracle-quest').textContent())}`);
  const oracleCardId = await page.getByTestId('oracle-quest').locator('[data-testid^="quest-card-"]').getAttribute('data-testid');
  const oracleQuestId = Number(oracleCardId!.replace('quest-card-', ''));
  await shot(page, project, '06-delphes-revealed');

  // ---- 07 Quest board -----------------------------------------------------------------------
  art.start('board');
  await page.goto(`/#/p/${profileId}/quetes`);
  await expect(page.getByRole('heading', { name: 'Le tableau des quêtes' })).toBeVisible();
  await expect(page.getByTestId(`quest-card-${oracleQuestId}`)).toBeVisible();
  await page.getByTestId('board-challenge-echo').getByRole('button', { name: 'Lancer une quête' }).click();
  await expect(page.getByTestId('board-challenge-echo')).toContainText('Quête en cours');
  await page.getByTestId('board-challenge-chimere').getByRole('button', { name: 'Lancer une quête' }).click();
  await expect(page.getByTestId('board-challenge-chimere')).toContainText('Quête en cours');
  await page.getByTestId('board-challenge-protee').getByRole('button', { name: 'Lancer une quête' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  notes.push(`board third-quest refusal: ${clean(await page.getByRole('alert').textContent())}`);
  notes.push(`board quest cards: ${JSON.stringify(await texts(page, '.quest-card'))}`);
  notes.push(`board challenge cards: ${JSON.stringify(await texts(page, '.challenge-card'))}`);
  notes.push(`board Éris panel: ${clean(await page.getByTestId('board-boss').textContent())}`);
  await shot(page, project, '07-quest-board');
  notes.push(`red scan (board): ${JSON.stringify(await redScan(page))}`);
  // Shelve the Chimère quest: the no-penalty confirmation wording.
  const chimereCard = page.locator('.quest-card', { hasText: 'Chimère' }).first();
  await chimereCard.locator('[data-testid^="quest-shelve-"]').click();
  notes.push(`shelve confirm: ${clean(await chimereCard.locator('.confirm').textContent())}`);
  await shot(page, project, '07b-quest-shelve-confirm');
  await chimereCard.getByRole('button', { name: 'Oui' }).click();
  await expect(page.locator('.quest-card', { hasText: 'Chimère' })).toHaveCount(0);

  // ---- 08 Lieutenant page (Hydre, gauges at 0) -----------------------------------------------
  art.start('lieutenant');
  await page.goto(`/#/p/${profileId}/monstres/hydre`);
  await expect(page.getByTestId('lieutenant-gauge-days')).toContainText('0/3');
  notes.push(`lieutenant hydre: ${clean(await page.locator('.screen').textContent())}`);
  await shot(page, project, '08-lieutenant-hydre');
  notes.push(`red scan (lieutenant): ${JSON.stringify(await redScan(page))}`);
  notes.push(`imgs without alt (lieutenant): ${await imgsWithoutAlt(page)}`);

  // ---- 09-10 Bestiary ------------------------------------------------------------------------
  art.start('bestiary');
  await page.goto(`/#/p/${profileId}/bestiaire`);
  await expect(page.getByTestId('bestiary-card-hydre')).toBeVisible();
  notes.push(`bestiary cards: ${JSON.stringify(await texts(page, '.bestiary-card'))}`);
  await shot(page, project, '09-bestiary-locked');
  notes.push(`imgs without alt (bestiary): ${await imgsWithoutAlt(page)}`);
  await page.getByTestId('bestiary-card-hydre').click();
  await expect(page.getByRole('heading', { name: 'Le mythe' })).toBeVisible();
  notes.push(`bestiary hydre locked: ${clean(await page.locator('.entry').textContent())}`);
  await shot(page, project, '10-bestiary-entry-locked');
  // An always-open page (tool) for the myth/fiction separation.
  await page.goto(`/#/p/${profileId}/bestiaire/ariane`);
  await expect(page.getByRole('heading', { name: 'Le mythe' })).toBeVisible();
  await shot(page, project, '10b-bestiary-entry-ariane');

  // ---- 11 Dossier (fresh) --------------------------------------------------------------------
  art.start('dossier');
  await page.goto(`/#/p/${profileId}/dossier`);
  await expect(page.getByRole('heading', { name: "Le dossier d'Éris" })).toBeVisible();
  await expect(page.getByTestId('dossier-line-hydre')).toBeVisible();
  notes.push(`dossier fresh: ${clean(await page.locator('.dossier').textContent())}`);
  await shot(page, project, '11-dossier-fresh');
  notes.push(`red scan (dossier): ${JSON.stringify(await redScan(page))}`);

  // ---- Texts + one Oracle-quest session via the API (day 1 of the Hydre window) ---------------
  const textA = await createText(request, { title: `${TEXT_A.title} (${project})`, body: TEXT_A.body, level: '10H' });
  const textB = await createText(request, { title: `${TEXT_B.title} (${project})`, body: TEXT_B.body, level: '10H' });
  const textC = await createText(request, { title: `${TEXT_C.title} (${project})`, body: TEXT_C.body, level: '10H' });
  const bossText = await createText(request, { title: `${BOSS_TEXT.title} (${project})`, body: BOSS_TEXT.body, level: '10H' });
  notes.push(`boss text word count (API): ${bossText.word_count}`);
  // Previous ISO week, so the weekly goal (3 texts this week) is reached by UI sessions only.
  const r1 = await postSession(request, {
    profileId,
    textId: textA.id,
    day: '2026-09-14',
    result: makeResult({ draft: 5, caught: 5, category: 'agreement:verb' }),
  });
  notes.push(`API day 2026-09-14: quests=${JSON.stringify(r1.progression.quests)} neutralised=${JSON.stringify(r1.progression.neutralised)}`);

  // ---- 12-13 A UI session that counts for the Oracle quest ------------------------------------
  art.start('play (quest intro)');
  await page.goto(`/#/p/${profileId}/play/${textA.id}?quest=${oracleQuestId}&encounter=hydre`);
  await expect(page.getByTestId('play-quest-banner')).toBeVisible();
  notes.push(`quest banner: ${clean(await page.getByTestId('play-quest-banner').textContent())}`);
  await shot(page, project, '12-play-quest-intro');
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await dictate(page, TEXT_A.draft);
  await page.getByTestId('btn-finish-writing').click();
  await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
  await editWord(page, TEXT_A.fix[0], TEXT_A.fix[1]);
  await finishProofreading(page);
  await expect(page.getByTestId('reveal-xp')).toBeVisible();
  await expect(page.getByTestId(`reveal-quest-${oracleQuestId}`)).toBeVisible();
  notes.push(`reveal (session 1): ${clean(await page.locator('.reveal-stack').textContent())}`);
  await shot(page, project, '13-progression-reveal-xp', 2600);
  notes.push(`red scan (reveal 1): ${JSON.stringify(await redScan(page))}`);
  await page.getByTestId('reveal-continue').click();
  await expect(page.getByTestId('reveal-xp')).toHaveCount(0);
  await expect(page.getByTestId('results-catch-rate')).toBeVisible();
  notes.push(`results (session 1): ${clean(await page.locator('.hero').textContent())} / Éris: ${clean(await page.locator('.eris-line').textContent())}`);
  await shot(page, project, '13b-results-after-reveal');

  // ---- Day 2 of the window via the API (completes the Oracle quest: 3/3 → Écume) ------------
  const r2 = await postSession(request, {
    profileId,
    textId: textA.id,
    day: '2026-09-15',
    result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }),
  });
  notes.push(`API day 2026-09-15: quests=${JSON.stringify(r2.progression.quests)} rewards=${JSON.stringify(r2.progression.rewards)} neutralised=${JSON.stringify(r2.progression.neutralised)}`);
  expect(r2.progression.neutralised).toEqual([]);
  // Lieutenant page mid-window: 2/3 days, 9/10 traps.
  await page.goto(`/#/p/${profileId}/monstres/hydre`);
  await expect(page.getByTestId('lieutenant-gauge-days')).toContainText('2/3');
  notes.push(`lieutenant hydre mid-window: ${clean(await page.locator('.gauges').textContent())}`);
  await shot(page, project, '13c-lieutenant-hydre-mid-window');

  // ---- 14-15 The hatch: day 3 in the UI ------------------------------------------------------
  art.start('play (hatch)');
  await page.goto(`/#/p/${profileId}/play/${textB.id}?encounter=hydre`);
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await dictate(page, TEXT_B.draft);
  await page.getByTestId('btn-finish-writing').click();
  await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
  await editWord(page, TEXT_B.fix[0], TEXT_B.fix[1]);
  await finishProofreading(page);
  await expect(page.getByTestId('reveal-neutralised-hydre')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('reveal-dragon')).toContainText("L'œuf éclôt");
  await expect(page.getByTestId('reveal-name-input')).toBeVisible();
  notes.push(`reveal (hatch): ${clean(await page.locator('.reveal-stack').textContent())}`);
  await shot(page, project, '14-progression-reveal-hatch', 2600);
  notes.push(`red scan (reveal hatch): ${JSON.stringify(await redScan(page))}`);
  notes.push(`imgs without alt (reveal hatch): ${await imgsWithoutAlt(page)}`);
  await page.getByTestId('reveal-name-input').fill('Braise');
  await page.getByTestId('reveal-name-save').click();
  await expect(page.getByTestId('reveal-name-input')).toHaveCount(0);
  notes.push(`reveal (named): ${clean(await page.getByTestId('reveal-dragon').textContent())}`);
  await shot(page, project, '15-progression-reveal-named', 2600);
  await page.getByTestId('reveal-continue').click();
  await expect(page.getByTestId('results-catch-rate')).toBeVisible();

  // ---- 16 Camp with the hatchling ------------------------------------------------------------
  art.start('camp (hatchling)');
  await page.goto(`/#/p/${profileId}/camp`);
  await expect(page.getByTestId('camp-dragon')).toContainText('Braise');
  notes.push(`camp hatchling: ${clean(await page.locator('.camp').textContent())}`);
  await shot(page, project, '16-camp-hatchling');

  // ---- 17 Dragon screen: tints (Écume unlocked) ---------------------------------------------
  art.start('dragon');
  await page.getByTestId('camp-dragon').click();
  await expect(page.getByTestId('dragon-stage')).toContainText('Dragonnet');
  await expect(page.getByTestId('dragon-tint-ecume')).toBeEnabled();
  notes.push(`dragon screen: ${clean(await page.locator('.dragon-screen').textContent())}`);
  notes.push(`dragon tints disabled: ${JSON.stringify(await page.locator('.tint-swatch:disabled').allTextContents())}`);
  await shot(page, project, '17-dragon-screen-tints');
  await page.getByTestId('dragon-tint-ecume').click();
  await expect(page.locator('img.dragon').first()).toHaveAttribute('style', /hue-rotate\(190deg\)/);
  await shot(page, project, '17b-dragon-ecume');
  notes.push(`small targets (dragon): ${JSON.stringify(await smallTargets(page))}`);

  // ---- 18 Cabin --------------------------------------------------------------------------------
  art.start('cabin');
  await page.goto(`/#/p/${profileId}/cabane`);
  await expect(page.getByTestId('cabin-reward-tint:ecume')).toHaveAttribute('data-owned', 'true');
  await expect(page.getByTestId('cabin-reward-ecaille_hydre')).toHaveAttribute('data-owned', 'true');
  notes.push(`cabin: ${clean(await page.locator('.cabin').textContent())}`);
  notes.push(`cabin owned: ${JSON.stringify(await page.locator('[data-owned="true"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid'))))}`);
  await shot(page, project, '18-cabin');
  notes.push(`red scan (cabin): ${JSON.stringify(await redScan(page))}`);

  // ---- 19 Dossier neutralised ------------------------------------------------------------------
  art.start('dossier 2');
  await page.goto(`/#/p/${profileId}/dossier`);
  await expect(page.getByTestId('dossier-line-hydre')).toContainText("L'Hydre est neutralisée");
  notes.push(`dossier after hatch: ${clean(await page.locator('.dossier').textContent())}`);
  await shot(page, project, '19-dossier-neutralised');

  // ---- 20 Bestiary entry unlocked --------------------------------------------------------------
  await page.goto(`/#/p/${profileId}/bestiaire/hydre`);
  await expect(page.getByText('Iolaos')).toBeVisible();
  notes.push(`bestiary hydre unlocked: ${clean(await page.locator('.entry').textContent())}`);
  await shot(page, project, '20-bestiary-entry-unlocked');
  await page.goto(`/#/p/${profileId}/monstres/hydre`);
  await expect(page.getByTestId('lieutenant-neutralised')).toBeVisible();
  notes.push(`lieutenant hydre neutralised: ${clean(await page.locator('.screen').textContent())}`);
  await shot(page, project, '20b-lieutenant-hydre-neutralised');

  // ---- Neutralise Écho via the API (tier 1 needs 2 of 6) → boss available ---------------------
  let echoRes: any = null;
  for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) {
    const res = await postSession(request, {
      profileId,
      textId: textA.id,
      day,
      result: makeResult({ draft: 4, caught: 4, category: 'homophone' }),
    });
    if (res.progression.neutralised.includes('echo')) {
      echoRes = res;
      break;
    }
  }
  expect(echoRes).not.toBeNull();
  notes.push(`Écho neutralised via API: quests=${JSON.stringify(echoRes.progression.quests)} rewards=${JSON.stringify(echoRes.progression.rewards)} dragon=${JSON.stringify(echoRes.progression.dragon)}`);

  // ---- 21 Boss intro ---------------------------------------------------------------------------
  art.start('camp (boss)');
  await page.goto(`/#/p/${profileId}/camp`);
  await expect(page.getByTestId('camp-boss')).toBeVisible();
  notes.push(`camp boss panel: ${clean(await page.getByTestId('camp-boss').textContent())}`);
  await shot(page, project, '21-camp-boss-available');
  art.start('boss');
  await page.getByTestId('camp-boss').click();
  await expect(page.getByTestId('boss-start')).toBeVisible();
  notes.push(`boss screen: ${clean(await page.locator('.boss').textContent())}`);
  await shot(page, project, '21b-boss-intro');
  notes.push(`red scan (boss): ${JSON.stringify(await redScan(page))}`);
  notes.push(`imgs without alt (boss): ${await imgsWithoutAlt(page)}`);

  // ---- 22-23 The fight, lost -------------------------------------------------------------------
  await page.getByTestId('boss-start').click();
  await expect(page).toHaveURL(/encounter=eris/);
  await expect(page.getByTestId('play-boss-banner')).toBeVisible();
  const bossUrl = page.url();
  const bossTextId = Number(bossUrl.match(/\/play\/(\d+)/)?.[1]);
  const bossQuestId = Number(bossUrl.match(/quest=(\d+)/)?.[1]);
  const bossBody = ((await (await request.get(`/api/texts/${bossTextId}`)).json()) as { body: string; title: string }).body;
  notes.push(`boss text picked: id=${bossTextId} title=${clean(await page.locator('h1').first().textContent())} words=${bossBody.split(/\s+/).length}`);
  notes.push(`boss banner: ${clean(await page.getByTestId('play-boss-banner').textContent())}`);
  notes.push(`boss pace cards: ${JSON.stringify(await texts(page, '[data-testid^="pace-option-"]'))}`);
  await shot(page, project, '22-play-boss-intro');
  const paceUsed = await pickLowestPace(page);
  const { draft: bossDraft, planted, missing, fixes: bossFixes } = plantBoss(bossBody);
  notes.push(`boss pace used: ${paceUsed}; planted (${planted.length}): ${planted.join(' | ')}${missing.length ? `; NOT planted: ${missing.join(' | ')}` : ''}`);
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await dictate(page, bossDraft);
  await page.getByTestId('btn-finish-writing').click();
  await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
  notes.push(`boss proofreading subtitle: ${clean(await page.locator('.proof .subtitle').textContent())}`);
  await shot(page, project, '22b-boss-proofreading');
  await finishProofreading(page);
  await expect(page.getByTestId('reveal-boss')).toBeVisible({ timeout: 15_000 });
  notes.push(`reveal (boss lost): ${clean(await page.locator('.reveal-stack').textContent())}`);
  await shot(page, project, '23-reveal-boss-lost', 2600);
  notes.push(`red scan (reveal boss lost): ${JSON.stringify(await redScan(page))}`);
  await page.getByTestId('reveal-continue').click();
  await expect(page.getByTestId('results-catch-rate')).toBeVisible();
  notes.push(`results (boss lost): ${clean(await page.locator('.hero').textContent())} / Éris: ${clean(await page.locator('.eris-line').textContent())}`);
  await shot(page, project, '23b-results-boss-lost');
  // The quest is still there, the button still reads « Affronter Éris ».
  await page.goto(`/#/p/${profileId}/eris`);
  await expect(page.getByTestId('boss-start')).toBeVisible();
  notes.push(`boss screen after loss: ${clean(await page.locator('.boss').textContent())}`);
  await shot(page, project, '23c-boss-after-loss');

  // ---- The fight again, won this time (P1-5: real proofreading, not a perfect dictation) ------
  // A perfect/near-perfect draft is no longer a win (that was the P1-5 bug - "Éris n'a rien trouvé
  // à saboter" handed over the tier's biggest reward for zero proofreading); a real win needs a
  // catch rate >= 0.7 over >= 3 draft errors, so this pass plants the same errors as the lost
  // fight and then actually catches them during relecture, at their exact position (`bossFixes`),
  // since a common word like « et »/« à » can also occur naturally elsewhere in the text.
  expect(bossFixes.length, `boss text offered too few plantable errors to prove a real win: ${JSON.stringify(missing)}`).toBeGreaterThanOrEqual(3);
  await page.getByTestId('boss-start').click();
  await expect(page).toHaveURL(/encounter=eris/);
  // The lost fight's results are the saved play state for this text: the screen resumes there
  // and « Rejouer ce texte » starts a fresh session.
  const replay = page.getByRole('button', { name: 'Rejouer ce texte' });
  const commence = page.getByRole('button', { name: 'Commencer la dictée' });
  await expect(replay.or(commence)).toBeVisible();
  if (await replay.isVisible()) await replay.click();
  await expect(commence).toBeVisible();
  await pickLowestPace(page);
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await dictate(page, bossDraft);
  await page.getByTestId('btn-finish-writing').click();
  await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
  notes.push(`boss (real proofreading) proofreading subtitle: ${clean(await page.locator('.proof .subtitle').textContent())}`);
  for (const fix of bossFixes) {
    await editWord(
      page,
      fix.wrong,
      fix.correct,
      occurrenceIndex(bossDraft, fix.wordIndex),
      occurrenceIndex(bossBody, fix.wordIndex),
    );
  }
  await finishProofreading(page);
  await expect(page.getByTestId('reveal-boss')).toBeVisible({ timeout: 15_000 });
  notes.push(`reveal (boss won, caught all ${bossFixes.length} planted errors): ${clean(await page.locator('.reveal-stack').textContent())}`);
  await shot(page, project, '23f-reveal-boss-won', 2600);
  await page.getByTestId('reveal-continue').click();
  await expect(page.getByTestId('results-catch-rate')).toBeVisible();
  notes.push(`results (boss won): ${clean(await page.locator('.hero').textContent())} / Éris: ${clean(await page.locator('.eris-line').textContent())}`);
  await page.goto(`/#/p/${profileId}/cabane`);
  await expect(page.getByTestId('cabin-reward-sandales_hermes')).toHaveAttribute('data-owned', 'true');
  await page.getByTestId('cabin-equip-sandales_hermes').click();
  await expect(page.getByTestId('cabin-equip-sandales_hermes')).toContainText('Ranger');
  await shot(page, project, '23d-cabin-after-boss');
  await page.goto(`/#/p/${profileId}/quetes`);
  await expect(page.getByRole('heading', { name: 'Le tableau des quêtes' })).toBeVisible();
  await page.locator('summary').click();
  notes.push(`board after boss: Éris panel: ${clean(await page.getByTestId('board-boss').textContent())}`);
  await shot(page, project, '23e-quest-board-after-boss');

  // ---- 24 Break nudge --------------------------------------------------------------------------
  art.start('play (break)');
  await page.goto(`/#/p/${profileId}/play/${textC.id}`);
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  // A first reload gives a fresh document: the boss session's clock registered a
  // `visibilitychange` listener that would otherwise persist the in-memory clock (0 min) over
  // the seed below while the page unloads. Then seed, then reload so the module reads it.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  await page.evaluate(() =>
    sessionStorage.setItem(
      'discorde.playClock',
      JSON.stringify({ activeMs: 26 * 60000, running: false, lastTick: null, lastStop: Date.now() }),
    ),
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await dictate(page, TEXT_C.draft);
  await page.getByTestId('btn-finish-writing').click();
  await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
  await finishProofreading(page);
  await expect(page.getByTestId('break-nudge')).toBeVisible({ timeout: 15_000 });
  notes.push(`break nudge: ${clean(await page.getByTestId('break-nudge').textContent())}`);
  await shot(page, project, '24-break-nudge', 2600);
  await page.getByTestId('break-continue').click();
  await expect(page.getByTestId('break-nudge')).toHaveCount(0);

  // ---- 25 Settings ---------------------------------------------------------------------------------
  await page.goto(`/#/p/${profileId}/settings`);
  await expect(page.getByRole('heading', { name: 'Objectif de la semaine' })).toBeVisible();
  notes.push(`settings: ${clean(await page.locator('form').textContent())}`);
  await shot(page, project, '25-settings-sound-weekly');

  // ---- 26 Camp, weekly goal reached ---------------------------------------------------------------
  art.start('camp (weekly)');
  await page.goto(`/#/p/${profileId}/camp`);
  await expect(page.getByTestId('camp-weekly')).toContainText('Objectif atteint');
  notes.push(`camp weekly reached: ${clean(await page.locator('.camp').textContent())}`);
  await shot(page, project, '26-camp-weekly-reached');
  await expect(page.locator('body')).not.toContainText(/manqué|raté|perdu|échec\b/i);

  // ---- 27 Reduced motion --------------------------------------------------------------------------
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/#/p/${profileId}/camp`);
  await expect(page.getByTestId('camp-dragon')).toContainText('Braise');
  const opacities = await page.locator('.camp .card, .camp .scene h1, .camp .eris-panel').evaluateAll((els) =>
    els.map((e) => getComputedStyle(e).opacity),
  );
  notes.push(`reduced-motion camp opacities: ${JSON.stringify(opacities)}`);
  await shot(page, project, '27-camp-reduced-motion');
  await page.goto(`/#/p/${profileId}/delphes`);
  await expect(page.locator('.scroll').first()).toBeVisible();
  const scrollOpacity = await page.locator('.scroll .content.open').evaluateAll((els) => els.map((e) => `${getComputedStyle(e).opacity}/${getComputedStyle(e).maxHeight}`));
  notes.push(`reduced-motion delphes open-content: ${JSON.stringify(scrollOpacity)}`);
  await shot(page, project, '27b-delphes-reduced-motion');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // ---- 28-32 A younger sibling (6H) ---------------------------------------------------------------
  art.start('sibling');
  const sibling = `Léo-${project}`;
  await createProfileUi(page, sibling, '6H');
  const siblingId = Number(page.url().match(/#\/p\/(\d+)\//)?.[1]);
  await page.getByTestId('onboarding-skip').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('camp-bestiary')).toBeVisible();
  notes.push(`sibling camp: ${clean(await page.locator('.camp').textContent())}`);
  await shot(page, project, '28-sibling-camp');
  await page.goto(`/#/p/${siblingId}/dossier`);
  await expect(page.getByTestId('dossier-line-hydre')).toBeVisible();
  notes.push(`sibling dossier: ${clean(await page.locator('.dossier').textContent())}`);
  await shot(page, project, '29-sibling-dossier');
  await page.goto(`/#/p/${siblingId}/quetes`);
  await expect(page.getByTestId('board-challenge-protee')).toBeVisible();
  notes.push(`sibling board challenge cards: ${JSON.stringify(await texts(page, '.challenge-card'))}`);
  notes.push(`sibling board Éris: ${clean(await page.getByTestId('board-boss').textContent())}`);
  await shot(page, project, '30-sibling-board');
  await page.goto(`/#/p/${siblingId}/delphes`);
  await page.getByTestId('scroll-ecole').getByTestId('scroll-open').click();
  await expect(page.getByTestId('oracle-monster-protee')).toBeDisabled();
  notes.push(`sibling picker chips: ${JSON.stringify(await texts(page, '.picker-grid .chip'))}`);
  await shot(page, project, '31-sibling-oracle-picker');
  await page.getByTestId('oracle-cancel').click();
  await expect(page.getByTestId('scroll-open')).toHaveCount(3);
  await page.goto(`/#/p/${siblingId}/parchemins`);
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  notes.push(`sibling library first cards: ${JSON.stringify((await texts(page, '[data-testid="text-card"]')).slice(0, 4))}`);
  await shot(page, project, '32-sibling-parchemins');

  }
});
