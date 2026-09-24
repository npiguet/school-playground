import { test, expect, type Page } from '@playwright/test';
import { createProfile, createText, stubSpeech } from './helpers';

// Playability walk for the SP2 review (spec §6.2): one long test per iPad orientation, every
// screen screenshotted into docs/reviews/sp2/<project>-NN-<screen>.png. Covers the SP2 features
// only (scan, Grimoire corrompu, Fil d'Ariane, chain explanations, 1990 reform, Alexandria);
// the SP1 walk lives in playability.spec.ts. Uses the offline Alexandria fixtures and the scan
// fixture image exactly like the SP2 e2e specs do.

const OUT = '/work/docs/reviews/sp2';
const GRIMOIRE_TITLE = 'Nausicaa et la lessive'; // 10H seed: conj subject (medium), "riaient" (high)
const CHAIN_TITLE = "La chouette d'Athéna"; // 10H seed: elisions, qui-relative, participle with avoir

// Realistic 10H mistakes planted in the dictation draft of "La chouette d'Athéna". The reform
// entries are NOT mistakes: they must grade as correct (spec §5 SP2 "1990 spelling reform
// variants accepted").
const PLANTED: { re: RegExp; to: string; kind: string }[] = [
  { re: /\bse taisaient\b/, to: 'se taisait', kind: 'verb -nt, subject « Les autres oiseaux » (elision « n\'intriguait » before)' },
  { re: /\bne distinguaient\b/, to: 'ne distinguait', kind: 'verb -nt, subject « les autres » (medium chain)' },
  { re: /\bqui l'entendaient\b/, to: "qui l'entendait", kind: 'verb -nt through relative « qui » (antecedent « Les habitants »)' },
  { re: /\bveillait sur\b/, to: 'veillaient sur', kind: 'verb -nt attraction, subject « la déesse elle-même »' },
  { re: /\bl'avait choisie\b/, to: "l'avait choisi", kind: 'participle with avoir, COD « l\' » before' },
  { re: /\btoits endormis\b/, to: 'toits endormi', kind: 'participle used as adjective (nominal chain)' },
  { re: /\bruelles étroites\b/, to: 'ruelles étroite', kind: 'adjective plural (nominal chain)' },
  { re: /\byeux dorés\b/, to: 'yeux doré', kind: 'adjective plural (nominal chain)' },
  { re: /\bappris à connaître\b/, to: 'appris a connaitre', kind: 'homophone a/à + REFORM « connaitre » (must be accepted)' },
  { re: /\bses grands yeux ronds\b/, to: 'ces grands yeux ronds', kind: 'homophone ces/ses' },
  { re: /\bclair là où /, to: 'clair la où ', kind: 'homophone là/la' },
  { re: /\bsa maîtresse\b/, to: 'sa maitresse', kind: 'REFORM « maitresse » (must be accepted)' },
];

// A short 10H custom text for the conj-subject / être-participle / qui chains and more reform
// variants. The draft breaks the coordinated subject, the participle with être and the
// qui-relative, and spells four words the 1990 way.
const FESTIN = {
  title: 'Le festin des Muses',
  body:
    "Le soir de l'événement, le cuisinier et sa fille coupaient un oignon sans connaître la recette. " +
    'Les Muses, arrivées en avance, étaient fatiguées mais restaient joyeuses. ' +
    'Les invités qui attendaient dans la cour semblaient impatients. ' +
    'La cuisinière, elle, voulait paraître calme et sûre d\'elle.',
  draft:
    "Le soir de l'évènement, le cuisinier et sa fille coupait un ognon sans connaitre la recette. " +
    'Les Muses, arrivés en avance, étaient fatigués mais restaient joyeuse. ' +
    'Les invités qui attendait dans la cour semblaient impatient. ' +
    'La cuisinière, elle, voulait paraitre calme et sûre d\'elle.',
};

interface Plant {
  token: number;
  start: number;
  end: number;
  original: string;
  mutated: string;
  category: string;
}

function plant(body: string): { draft: string; planted: string[]; missing: string[] } {
  let draft = body;
  const planted: string[] = [];
  const missing: string[] = [];
  for (const p of PLANTED) {
    if (p.re.test(draft)) {
      draft = draft.replace(p.re, p.to);
      planted.push(p.kind);
    } else missing.push(p.kind);
  }
  return { draft, planted, missing };
}

async function shot(page: Page, project: string, name: string) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${project}-${name}.png`, fullPage: true });
}

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tok(page: Page, word: string) {
  return page.locator('[data-testid^="tok-"]', { hasText: new RegExp(`^${esc(word)}$`) });
}

async function editWord(page: Page, from: string, to: string) {
  await tok(page, from).first().click();
  const editor = page.getByTestId('word-editor');
  await editor.fill(to);
  await editor.press('Enter');
  await expect(tok(page, to).first()).toBeVisible();
}

async function dictateAtPace1(page: Page, draft: string) {
  const ta = page.getByTestId('dictation-textarea');
  const next = page.getByTestId('btn-next');
  const finish = page.getByTestId('btn-finish-writing');
  await expect(next).toBeEnabled({ timeout: 10_000 });
  for (let i = 0; i < 40; i++) {
    if (await finish.isVisible()) break;
    await expect(next).toBeEnabled({ timeout: 10_000 });
    await next.click();
    await page.waitForTimeout(80);
  }
  await expect(finish).toBeVisible();
  await ta.fill(draft);
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

async function explanations(page: Page): Promise<string[]> {
  const items = await page.locator('.category li').allTextContents();
  return items.map((s) => s.replace(/\s+/g, ' ').trim());
}

async function popoverFor(page: Page, word: string): Promise<string> {
  const t = page.locator('.results .tok.err', { hasText: new RegExp(`^${esc(word)}$`) }).first();
  if ((await t.count()) === 0) return `(no error token « ${word} »)`;
  await t.click();
  await expect(page.locator('.popover-panel')).toBeVisible();
  return ((await page.locator('.popover-panel').textContent()) ?? '').replace(/\s+/g, ' ').trim();
}

// Play.svelte loads its text once on mount: a hash-only navigation from one /play/<id> to
// another keeps the old text on screen, so always pass through the library first.
async function gotoPlay(page: Page, profileId: number, textId: number) {
  await page.goto(`/#/p/${profileId}/camp`);
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  await page.goto(`/#/p/${profileId}/play/${textId}`);
}

// After a drawn thread the Fil panel stays open in its "done" state (a further tap opens the
// word editor instead of picking a verb), so the tool has to be exited, then started again.
async function rearmFil(page: Page) {
  if (await page.getByTestId('fil-message').isVisible()) await page.getByTestId('btn-fil-exit').click();
  await page.getByTestId('btn-fil').click();
  await expect(page.getByTestId('fil-message')).toContainText('Touche un verbe');
}

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

test('SP2 playability walk', async ({ page, request }, testInfo) => {
  const project = testInfo.project.name;
  const notes: string[] = [];
  await stubSpeech(page);

  // ---- Profile ----------------------------------------------------------------------------
  const name = `Ariane-${project}`;
  await createProfile(page, name, '10H');
  const profileId = Number(page.url().match(/#\/p\/(\d+)\//)?.[1]);
  expect(profileId).toBeGreaterThan(0);

  // ---- 01 Add menu ------------------------------------------------------------------------
  await page.getByTestId('btn-add-text').click();
  await expect(page.getByRole('dialog', { name: 'Ajouter un parchemin' })).toBeVisible();
  await shot(page, project, '01-add-menu');

  // ---- 02 Scan: capture -------------------------------------------------------------------
  await page.getByTestId('menu-add-scan').click();
  await expect(page.getByText('Prends la feuille imprimée en photo')).toBeVisible();
  await shot(page, project, '02-scan-capture-empty');
  await page.getByTestId('scan-input').first().setInputFiles('/work/server/tests/fixtures/scan/handout.png');
  await expect(page.locator('.thumb img')).toBeVisible();
  await shot(page, project, '02-scan-capture');

  // ---- 03 Scan: verify --------------------------------------------------------------------
  const t0 = Date.now();
  await page.getByTestId('btn-scan-read').click();
  await expect(page.getByText('Les scribes déchiffrent la feuille…')).toBeVisible();
  await shot(page, project, '02b-scan-reading');
  const sta = page.getByTestId('scan-textarea');
  await expect(sta).toHaveValue(/fées dansent dans la clairière/, { timeout: 90_000 });
  notes.push(`OCR wait: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const scanAttrs = {
    autocorrect: await sta.getAttribute('autocorrect'),
    autocapitalize: await sta.getAttribute('autocapitalize'),
    autocomplete: await sta.getAttribute('autocomplete'),
    spellcheck: await sta.getAttribute('spellcheck'),
    lang: await sta.getAttribute('lang'),
  };
  notes.push(`scan textarea attributes: ${JSON.stringify(scanAttrs)}`);
  const chips = page.getByTestId('scan-low-confidence');
  notes.push(
    (await chips.count()) > 0
      ? `« À vérifier » chips: ${(await chips.locator('.chip').allTextContents()).join(', ')}`
      : '« À vérifier » chips: none shown',
  );
  notes.push(`OCR text: ${JSON.stringify(await sta.inputValue())}`);
  await shot(page, project, '03-scan-verify');
  notes.push(`red scan (scan verify): ${JSON.stringify(await redScan(page))}`);
  const value = await sta.inputValue();
  await sta.fill(value.split('\n\n').filter((p) => !p.startsWith('Dictée')).join('\n\n'));
  await page.getByTestId('btn-scan-verified').click();

  // ---- 04 Scan: details -------------------------------------------------------------------
  await expect(page.getByRole('heading', { name: 'Détails du parchemin' })).toBeVisible();
  const due = plusDays(21);
  await page.getByTestId('scan-title').fill('Les fées de la clairière');
  await page.getByTestId('scan-due-date').fill(due);
  await shot(page, project, '04-scan-details');
  await page.getByTestId('btn-scan-save').click();

  // ---- 05 Library: prophecy ---------------------------------------------------------------
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Prophéties de l'Oracle" })).toBeVisible();
  const card = page.locator('[data-testid="text-card"]', { hasText: 'Les fées de la clairière' });
  notes.push(`prophecy card: ${((await card.first().textContent()) ?? '').replace(/\s+/g, ' ').trim()}`);
  await shot(page, project, '05-library-prophecy');

  // ---- 06 Play intro with the prophecy and the sheet ---------------------------------------
  await card.first().click();
  await expect(page.getByTestId('play-prophecy')).toBeVisible();
  notes.push(`intro prophecy: ${(await page.getByTestId('play-prophecy').textContent())?.trim()}`);
  await page.getByRole('button', { name: 'Voir la feuille' }).click();
  await expect(page.locator('img[src*="/api/scan/"]')).toBeVisible();
  await shot(page, project, '06-play-intro-prophecy');
  // Spec §3.3/§3.2: the photo (the answer key) must not be reachable during the dictation.
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expect(page.getByTestId('dictation-textarea')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('clairière');
  expect(await page.locator('img[src*="/api/scan/"]').count()).toBe(0);
  await shot(page, project, '06b-scan-dictation');
  await page.getByTestId('btn-quit-dictation').click();
  await page.getByTestId('btn-quit-confirm').click();
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeVisible();

  // ---- Reference bodies (API only) --------------------------------------------------------
  const texts = (await (await request.get(`/api/texts?profile_id=${profileId}`)).json()) as { id: number; title: string }[];
  const grimoireText = texts.find((t) => t.title === GRIMOIRE_TITLE)!;
  const chainText = texts.find((t) => t.title === CHAIN_TITLE)!;
  expect(grimoireText && chainText).toBeTruthy();

  // ---- 07 Grimoire corrompu: intro ---------------------------------------------------------
  await gotoPlay(page, profileId, grimoireText.id);
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  await shot(page, project, '07a-play-intro-with-grimoire-button');
  await page.getByTestId('btn-grimoire').click();
  await expect(page.getByRole('heading', { name: 'Grimoire corrompu' })).toBeVisible();
  await shot(page, project, '07-grimoire-intro');
  await page.getByTestId('btn-open-grimoire').click();

  // ---- 08 Grimoire: proofreading -----------------------------------------------------------
  await expect(page.getByText(/Éris a corrompu ce grimoire/)).toBeVisible();
  notes.push(`grimoire subtitle: ${(await page.locator('.proof .subtitle').textContent())?.trim()}`);
  const plants = (await page.evaluate(
    ([p, t]) => JSON.parse(localStorage.getItem(`discorde.play.${p}.${t}.grimoire`) ?? '{}').plants ?? [],
    [profileId, grimoireText.id],
  )) as Plant[];
  notes.push(`Éris planted (${plants.length}): ${plants.map((p) => `${p.original}→${p.mutated} [${p.category}]`).join(' | ')}`);
  const shown = (word: string) => plants.find((p) => p.original === word)?.mutated ?? word;
  await shot(page, project, '08-grimoire-proofreading');

  // ---- 09/10 Fil d'Ariane ------------------------------------------------------------------
  await page.getByTestId('btn-fil').click();
  await expect(page.getByTestId('fil-message')).toContainText('Touche un verbe');
  await shot(page, project, '09-fil-pick-verb');
  const filMsg = async () => ((await page.getByTestId('fil-message').textContent()) ?? '').trim();
  // A non-verb.
  await tok(page, shown('plage')).first().click();
  notes.push(`Fil tap « plage » (noun): ${await filMsg()}`);
  // A verb whose only chain is medium (coordinated subject « la princesse Nausicaa et ses servantes »).
  await tok(page, shown('étalaient')).first().click();
  notes.push(`Fil tap « ${shown('étalaient')} » (medium conj chain): ${await filMsg()}`);
  await shot(page, project, '09b-fil-medium-chain');
  // A verb with a high chain: riaient ← Les jeunes filles. Wrong subject first, then the right one.
  await tok(page, shown('riaient')).first().click();
  notes.push(`Fil tap « ${shown('riaient')} » (high chain): ${await filMsg()}`);
  await shot(page, project, '09c-fil-verb-picked');
  await tok(page, shown('balle')).first().click();
  notes.push(`Fil tap wrong subject « ${shown('balle')} »: ${await filMsg()}`);
  await tok(page, shown('filles')).first().click();
  notes.push(`Fil tap subject « ${shown('filles')} »: ${await filMsg()}`);
  await shot(page, project, '10-fil-thread');
  // Once a thread is drawn, the next tap leaves the Fil and opens the word editor (observed in
  // run 3: the second verb tap opened « Nouveau mot »), so the tool has to be re-armed first.
  notes.push(`Fil still active after a drawn thread: ${await page.getByTestId('fil-message').isVisible()}`);
  await rearmFil(page);
  // Second thread, let it fail twice to see the guided message.
  await tok(page, shown('roula')).first().click();
  notes.push(`Fil tap « ${shown('roula')} »: ${await filMsg()}`);
  await tok(page, shown('loin')).first().click();
  await tok(page, shown('buissons')).first().click();
  notes.push(`Fil two wrong subjects for « ${shown('roula')} »: ${await filMsg()}`);
  await shot(page, project, '10b-fil-guided');
  await page.getByTestId('btn-fil-exit').click();

  // Fix every other plant (only when its wrong form is unique in the text, so the tap is unambiguous).
  let fixed = 0;
  for (let i = 0; i < plants.length; i++) {
    if (i % 2 === 1) continue;
    const p = plants[i];
    if ((await tok(page, p.mutated).count()) !== 1) continue;
    await editWord(page, p.mutated, p.original);
    fixed++;
  }
  notes.push(`grimoire: fixed ${fixed} of ${plants.length} plants before validating`);
  await shot(page, project, '10c-grimoire-before-done');

  // ---- 11 Grimoire: results ----------------------------------------------------------------
  await page.getByTestId('btn-done-proofreading').click();
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  if (await confirm.isVisible()) await confirm.click();
  await expect(page.getByRole('heading', { name: 'Relecture terminée' })).toBeVisible();
  notes.push(`grimoire results: ${(await page.getByTestId('results-catch-rate').textContent())?.trim()} / ${(await page.getByTestId('results-score').textContent())?.trim()}`);
  const threads = page.getByTestId('results-threads');
  notes.push(`threads line: ${(await threads.count()) ? (await threads.textContent())?.trim() : '(absent)'}`);
  notes.push(`Éris (grimoire): ${(await page.locator('.eris-line').textContent())?.trim()}`);
  await shot(page, project, '11-grimoire-results');
  notes.push(`grimoire explanations:\n  - ${(await explanations(page)).join('\n  - ')}`);
  const firstErr = page.locator('.results .tok.err').first();
  if (await firstErr.count()) {
    await firstErr.click();
    await shot(page, project, '11b-grimoire-explanation');
    notes.push(`grimoire popover (« ${(await firstErr.textContent())?.trim()} »): ${((await page.locator('.popover-panel').textContent()) ?? '').replace(/\s+/g, ' ').trim()}`);
  }
  notes.push(`red scan (grimoire results): ${JSON.stringify(await redScan(page))}`);
  await page.getByTestId('btn-back-library').click();
  await page.locator('.topbar a[href$="/stats"]').click();
  await expect(page.getByRole('heading', { name: 'Progrès' })).toBeVisible();
  await shot(page, project, '11c-stats-after-grimoire');
  notes.push(`stats after grimoire mentions "Grimoire": ${await page.getByText('Grimoire').count()}`);

  // ---- 12 Dictation with realistic errors → chain explanations -----------------------------
  const full = (await (await request.get(`/api/texts/${chainText.id}`)).json()) as { body: string };
  const { draft, planted, missing } = plant(full.body);
  notes.push(`chain text planted (${planted.length}): ${planted.join(' | ')}`);
  if (missing.length) notes.push(`NOT planted: ${missing.join(' | ')}`);
  await gotoPlay(page, profileId, chainText.id);
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await dictateAtPace1(page, draft);
  await page.getByTestId('btn-finish-writing').click();
  await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('taisaient');
  // Fil on her own wrong verb: the message must quote her spelling, never the reference.
  await page.getByTestId('btn-fil').click();
  await tok(page, 'taisait').first().click();
  notes.push(`Fil (dictation) tap « taisait »: ${await filMsg()}`);
  await tok(page, 'oiseaux').first().click();
  notes.push(`Fil (dictation) tap « oiseaux »: ${await filMsg()}`);
  await shot(page, project, '12a-fil-on-typed-error');
  await rearmFil(page);
  await tok(page, "l'entendait").first().click();
  notes.push(`Fil (dictation) tap « l'entendait » (qui, medium): ${await filMsg()}`);
  await tok(page, 'veillaient').first().click();
  notes.push(`Fil (dictation) tap « veillaient »: ${await filMsg()}`);
  await tok(page, 'déesse').last().click();
  notes.push(`Fil (dictation) tap « déesse »: ${await filMsg()}`);
  await page.getByTestId('btn-fil-exit').click();
  await editWord(page, 'taisait', 'taisaient');
  await editWord(page, 'a', 'à');
  await page.getByTestId('btn-done-proofreading').click();
  if (await confirm.isVisible()) await confirm.click();
  await expect(page.getByRole('heading', { name: 'Relecture terminée' })).toBeVisible();
  notes.push(`chain results: ${(await page.getByTestId('results-catch-rate').textContent())?.trim()} / ${(await page.getByTestId('results-score').textContent())?.trim()}`);
  notes.push(`Éris (dictation): ${(await page.locator('.eris-line').textContent())?.trim()}`);
  notes.push(`chain explanations:\n  - ${(await explanations(page)).join('\n  - ')}`);
  const reformFlagged = await page.locator('.results .tok.err', { hasText: /^(connaitre|maitresse)$/ }).count();
  notes.push(`reform variants flagged as errors (must be 0): ${reformFlagged}`);
  notes.push(`popover « endormi »: ${await popoverFor(page, 'endormi')}`);
  await shot(page, project, '12-results-chain-explanation');
  notes.push(`popover « distinguait »: ${await popoverFor(page, 'distinguait')}`);
  notes.push(`popover « l'entendait »: ${await popoverFor(page, "l'entendait")}`);
  await shot(page, project, '12b-results-qui-explanation');
  notes.push(`popover « choisi »: ${await popoverFor(page, 'choisi')}`);
  notes.push(`popover « veillaient »: ${await popoverFor(page, 'veillaient')}`);
  notes.push(`popover « ces »: ${await popoverFor(page, 'ces')}`);
  notes.push(`red scan (chain results): ${JSON.stringify(await redScan(page))}`);

  // ---- 12c Custom text: coordinated subject, être + participle, qui, four reform spellings ---
  const festin = await createText(request, {
    title: `${FESTIN.title} (${project})`,
    body: FESTIN.body,
    level: '10H',
    source: 'custom',
    added_by_profile_id: profileId,
  });
  await gotoPlay(page, profileId, festin.id);
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await dictateAtPace1(page, FESTIN.draft);
  await page.getByTestId('btn-finish-writing').click();
  await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
  await page.getByTestId('btn-fil').click();
  await tok(page, 'coupait').first().click();
  notes.push(`Fil (festin) tap « coupait » (conj, medium): ${await filMsg()}`);
  await tok(page, 'attendait').first().click();
  notes.push(`Fil (festin) tap « attendait » (qui, medium): ${await filMsg()}`);
  await rearmFil(page);
  await tok(page, 'voulait').first().click();
  notes.push(`Fil (festin) tap « voulait »: ${await filMsg()}`);
  await tok(page, 'cuisinière').first().click();
  notes.push(`Fil (festin) tap « cuisinière »: ${await filMsg()}`);
  await page.getByTestId('btn-fil-exit').click();
  await page.getByTestId('btn-done-proofreading').click();
  if (await confirm.isVisible()) await confirm.click();
  await expect(page.getByRole('heading', { name: 'Relecture terminée' })).toBeVisible();
  notes.push(`festin results: ${(await page.getByTestId('results-catch-rate').textContent())?.trim()}`);
  notes.push(`festin explanations:\n  - ${(await explanations(page)).join('\n  - ')}`);
  const reformFlagged2 = await page.locator('.results .tok.err', { hasText: /^(ognon|évènement|connaitre|paraitre)$/ }).count();
  notes.push(`festin reform variants flagged as errors (must be 0): ${reformFlagged2}`);
  notes.push(`popover « coupait »: ${await popoverFor(page, 'coupait')}`);
  await shot(page, project, '12c-results-conj-reform');
  notes.push(`popover « fatigués »: ${await popoverFor(page, 'fatigués')}`);
  notes.push(`popover « arrivés »: ${await popoverFor(page, 'arrivés')}`);
  notes.push(`popover « attendait »: ${await popoverFor(page, 'attendait')}`);
  notes.push(`popover « joyeuse »: ${await popoverFor(page, 'joyeuse')}`);
  notes.push(`popover « impatient »: ${await popoverFor(page, 'impatient')}`);
  await shot(page, project, '12d-results-etre-participle');

  // ---- 13–16 Bibliothèque d'Alexandrie -----------------------------------------------------
  await page.goto(`/#/p/${profileId}/camp`);
  await page.getByTestId('btn-add-text').click();
  await page.getByTestId('menu-add-alexandria').click();
  await expect(page.getByRole('heading', { name: "Bibliothèque d'Alexandrie" })).toBeVisible();
  await expect(page.getByTestId('work-card').first()).toBeVisible();
  notes.push(`Alexandria works: ${await page.getByTestId('work-card').count()}; first: ${((await page.getByTestId('work-card').first().textContent()) ?? '').replace(/\s+/g, ' ').trim()}`);
  await shot(page, project, '13-alexandria-works');
  await page.locator('[data-testid="work-card"]', { hasText: 'Lettres de mon moulin' }).click();
  await expect(page.getByTestId('btn-refresh-work')).toBeVisible();
  await shot(page, project, '13b-alexandria-work-empty');
  const t1 = Date.now();
  await page.getByTestId('btn-refresh-work').click();
  await expect(page.getByText(/Les scribes recopient/)).toBeVisible();
  await shot(page, project, '13c-alexandria-refreshing');
  await expect(page.getByTestId('alexandria-error')).toContainText("hors d'atteinte", { timeout: 90_000 });
  notes.push(`Alexandria failure wait: ${((Date.now() - t1) / 1000).toFixed(1)} s; banner: ${(await page.getByTestId('alexandria-error').textContent())?.trim()}`);
  await shot(page, project, '14-alexandria-error');
  notes.push(`red scan (alexandria error): ${JSON.stringify(await redScan(page))}`);
  await page.goBack();
  await expect(page.getByTestId('work-card').first()).toBeVisible();
  notes.push(`works list after failure, Daudet card: ${((await page.locator('[data-testid="work-card"]', { hasText: 'Lettres de mon moulin' }).textContent()) ?? '').replace(/\s+/g, ' ').trim()}`);
  await page.locator('[data-testid="work-card"]', { hasText: 'Vingt mille lieues' }).click();
  const t2 = Date.now();
  await page.getByTestId('btn-refresh-work').click();
  await expect(page.getByTestId('chunk-card').first()).toBeVisible({ timeout: 150_000 });
  notes.push(`Alexandria refresh wait (Verne): ${((Date.now() - t2) / 1000).toFixed(1)} s; chunks: ${await page.getByTestId('chunk-card').count()}`);
  notes.push(`first chunk card: ${((await page.getByTestId('chunk-card').first().textContent()) ?? '').replace(/\s+/g, ' ').trim()}`);
  await shot(page, project, '15-alexandria-chunks');
  await page.getByTestId('btn-adopt').first().click();
  await expect(page.getByText('Rouleau ajouté aux Parchemins.')).toBeVisible();
  await shot(page, project, '16-alexandria-adopted');
  await page.getByTestId('btn-adopt-play').click();
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  notes.push(`adopted intro credits: ${(await page.locator('.credits').textContent())?.trim()}`);
  await shot(page, project, '16b-alexandria-play-intro');
  await page.goto(`/#/p/${profileId}/camp`);
  await expect(page.locator('.chip-online').first()).toBeVisible();
  notes.push(`library card (Alexandrie): ${((await page.locator('[data-testid="text-card"]', { has: page.locator('.chip-online') }).first().textContent()) ?? '').replace(/\s+/g, ' ').trim()}`);
  await shot(page, project, '16c-library-after-sp2');

  console.log(`\n===== NOTES ${project} =====\n${notes.join('\n')}\n`);
});
