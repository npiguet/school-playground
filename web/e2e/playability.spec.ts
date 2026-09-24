import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { stubSpeech } from './helpers';

// Playability walk for the SP1 review (spec §6.2). One test per iPad orientation; every screen
// is screenshotted into docs/reviews/sp1/<project>-NN-<screen>.png. The draft typed during the
// dictation is derived here from the reference body with realistic planted mistakes (the app
// never shows the reference).

const OUT = '/work/docs/reviews/sp1';
const TEXT_TITLE = "La chouette d'Athéna"; // 10H seed, 133 words
const PACE_TEXT_TITLE = 'Nausicaa et la lessive'; // second 10H seed, used for the pace screenshots

// Mistakes of the kinds she makes: agreement (-nt, -s, participle), homophones (a/à, ces/ses,
// la/là) and one lexical slip. Each pattern is applied once; a pattern that doesn't match is
// reported so the review knows which errors were actually planted.
const PLANTED: { re: RegExp; to: string; kind: string }[] = [
  { re: /\bse taisaient\b/, to: 'se taisait', kind: 'agreement verb -nt (subject « Les autres oiseaux »)' },
  { re: /\bappris à connaître\b/, to: 'appris a connaître', kind: 'homophone a/à' },
  { re: /\bses grands yeux ronds\b/, to: 'ces grands yeux ronds', kind: 'homophone ces/ses' },
  { re: /\bl'avait choisie\b/, to: "l'avait choisi", kind: 'participle with COD before (avoir)' },
  { re: /\btoits endormis\b/, to: 'toits endormi', kind: 'noun group -s' },
  { re: /\bruelles étroites\b/, to: 'ruelles étroite', kind: 'noun group -s (adjective)' },
  // No trailing \b: JS word boundaries are ASCII-only, so "où" never ends at a \b.
  { re: /\bclair là où /, to: 'clair la où ', kind: 'homophone là/la' },
  { re: /\battentive\b/, to: 'atentive', kind: 'lexical (double consonant)' },
];

const CUSTOM_TEXT = {
  title: 'Le matin au camp',
  body:
    'Au camp des demi-dieux, le matin commençait toujours par le même rituel. Les jeunes héros ' +
    'sortaient de leurs cabanes en bâillant, traversaient la prairie encore humide et se ' +
    'rassemblaient devant le grand feu. Le vieux centaure les attendait avec sa liste. Les uns ' +
    "partaient s'entraîner à l'épée, les autres rejoignaient les Muses pour apprendre à protéger " +
    'les textes anciens. Ce jour-là, pourtant, une rumeur courait entre les tentes : Éris avait ' +
    'été aperçue près de la bibliothèque, et les parchemins qu\'elle avait touchés semblaient tous ' +
    'désaccordés. Personne ne savait encore combien de pièges elle avait cachés.',
};

function plant(body: string): { draft: string; planted: string[]; missing: string[] } {
  let draft = body;
  const planted: string[] = [];
  const missing: string[] = [];
  for (const p of PLANTED) {
    if (p.re.test(draft)) {
      draft = draft.replace(p.re, p.to);
      planted.push(p.kind);
    } else {
      missing.push(p.kind);
    }
  }
  return { draft, planted, missing };
}

// Slows the speech stub down (the helper's stub "speaks" in 20 ms) so the listening state
// can be screenshotted, then speeds it back up once we are past the screenshot.
async function installSpeechTiming(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__speakMs = 20;
    const s = w.speechSynthesis;
    s.speak = (u: any) => {
      w.__spoken.push(u.text);
      setTimeout(() => u.onend?.({}), w.__speakMs);
    };
  });
}

async function setSpeakMs(page: Page, ms: number) {
  await page.evaluate((v) => ((window as any).__speakMs = v), ms);
}

async function shot(page: Page, project: string, name: string) {
  // Longer than the 0.2 s spotlight transition, so pass switches are captured settled.
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${project}-${name}.png`, fullPage: true });
}

function tok(page: Page, word: string) {
  return page.locator('[data-testid^="tok-"]', { hasText: new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
}

async function editWord(page: Page, from: string, to: string) {
  await tok(page, from).first().click();
  const editor = page.getByTestId('word-editor');
  await editor.fill(to);
  await editor.press('Enter');
  await expect(tok(page, to).first()).toBeVisible();
}

// Types the draft at pace 1: after each sentence is "spoken" the runner waits; we advance with
// Suivant until the finish button appears, then paste the whole draft.
async function dictateAtPace1(page: Page, draft: string, firstSentences?: string) {
  const ta = page.getByTestId('dictation-textarea');
  const next = page.getByTestId('btn-next');
  const finish = page.getByTestId('btn-finish-writing');
  await expect(next).toBeEnabled({ timeout: 10_000 });
  if (firstSentences) await ta.fill(firstSentences);
  for (let i = 0; i < 40; i++) {
    if (await finish.isVisible()) break;
    await expect(next).toBeEnabled({ timeout: 10_000 });
    await next.click();
    await page.waitForTimeout(80);
  }
  await expect(finish).toBeVisible();
  await ta.fill(draft);
}

async function createProfileApi(request: APIRequestContext, name: string, pin: string | null = null) {
  const res = await request.post('/api/profiles', {
    data: { name, avatar: 'chouette', level: '10H', pin },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { id: number; help_stage: number };
}

// Promotes a profile to `target` help stage the way the server does it: three sessions with
// catch rate >= 0.7 at the current stage move it up one stage.
async function promoteToStage(request: APIRequestContext, profileId: number, textId: number, target: number) {
  for (let guard = 0; guard < 12; guard++) {
    const p = (await (await request.get(`/api/profiles/${profileId}`)).json()) as { help_stage: number };
    if (p.help_stage >= target) return;
    const res = await request.post('/api/sessions', {
      data: {
        profile_id: profileId,
        text_id: textId,
        pace_level: 3,
        help_stage: p.help_stage,
        started_at: new Date().toISOString(),
        draft: 'x',
        final: 'x',
        result: { byCategory: {}, draftErrors: [], finalErrors: [], caught: [], missed: [], introduced: [] },
        score: 100,
        catch_rate: 1,
      },
    });
    expect(res.ok()).toBeTruthy();
  }
}

test('playability walk', async ({ page, request }, testInfo) => {
  const project = testInfo.project.name;
  const notes: string[] = [];
  await stubSpeech(page);
  await installSpeechTiming(page);

  // ---- 01 Profiles ------------------------------------------------------------------------
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'La Discorde' })).toBeVisible();
  await shot(page, project, '01-profiles');

  // ---- 02 Create profile (no code) ---------------------------------------------------------
  const name = `Léa-${project}`;
  await page.getByRole('button', { name: /Nouveau héros/ }).click();
  await page.getByLabel('Ton prénom').fill(name);
  await page.getByText('Dragon', { exact: true }).click();
  await page.getByLabel('Ton niveau').selectOption('10H');
  await shot(page, project, '02-profile-new');
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  const profileId = Number(page.url().match(/#\/p\/(\d+)\//)?.[1]);
  expect(profileId).toBeGreaterThan(0);

  // ---- 03 Library --------------------------------------------------------------------------
  await expect(page.locator('[data-testid="text-card"]').first()).toBeVisible();
  const firstCard = (await page.locator('[data-testid="text-card"] .title').first().textContent())?.trim();
  notes.push(`first card in "À ton niveau (10H)": ${firstCard}`);
  await shot(page, project, '03-library');

  // ---- 04 Add a text -----------------------------------------------------------------------
  await page.getByRole('button', { name: /Ajouter un texte/ }).click();
  await page.getByLabel('Titre').fill(`${CUSTOM_TEXT.title} (${project})`);
  await page.getByLabel('Texte').fill(CUSTOM_TEXT.body);
  await page.getByLabel('Auteur').fill('Les Muses');
  await shot(page, project, '04-text-new');
  await page.getByRole('button', { name: /Sauvegarder/ }).click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  await expect(page.locator('[data-testid="text-card"]', { hasText: `${CUSTOM_TEXT.title} (${project})` })).toBeVisible();
  await shot(page, project, '04b-library-with-custom');

  // ---- Reference body (through the API only; the app never shows it) ----------------------
  const texts = (await (await request.get(`/api/texts?profile_id=${profileId}`)).json()) as { id: number; title: string }[];
  const seed = texts.find((t) => t.title === TEXT_TITLE);
  expect(seed, `seed text "${TEXT_TITLE}" present`).toBeTruthy();
  const paceText = texts.find((t) => t.title === PACE_TEXT_TITLE);
  expect(paceText).toBeTruthy();
  const full = (await (await request.get(`/api/texts/${seed!.id}`)).json()) as { body: string };
  const { draft, planted, missing } = plant(full.body);
  notes.push(`planted (${planted.length}): ${planted.join(' | ')}`);
  if (missing.length) notes.push(`NOT planted: ${missing.join(' | ')}`);
  const sentences = draft.split(/(?<=\.)\s+/);

  // ---- 05 Play intro (pace select) ---------------------------------------------------------
  await page.locator('[data-testid="text-card"]', { hasText: TEXT_TITLE }).click();
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  await shot(page, project, '05-play-intro');
  await page.getByTestId('pace-option-1').click();

  // ---- 06 Dictation, listening -------------------------------------------------------------
  await setSpeakMs(page, 3000);
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  const ta = page.getByTestId('dictation-textarea');
  await expect(ta).toBeVisible();
  await expect(page.locator('body')).not.toContainText('silencieusement'); // reference never shown
  await expect(page.locator('body')).not.toContainText('intriguait');
  const attrs = {
    autocorrect: await ta.getAttribute('autocorrect'),
    autocapitalize: await ta.getAttribute('autocapitalize'),
    autocomplete: await ta.getAttribute('autocomplete'),
    spellcheck: await ta.getAttribute('spellcheck'),
    lang: await ta.getAttribute('lang'),
  };
  notes.push(`textarea attributes: ${JSON.stringify(attrs)}`);
  expect(attrs).toEqual({ autocorrect: 'off', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false', lang: 'fr' });
  await shot(page, project, '06-dictation-listening');
  await setSpeakMs(page, 20);

  // ---- 07 Dictation, typing ----------------------------------------------------------------
  await expect(page.getByTestId('btn-next')).toBeEnabled({ timeout: 10_000 });
  await ta.fill(sentences[0]);
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('btn-next')).toBeEnabled({ timeout: 10_000 });
  await ta.fill(sentences.slice(0, 2).join(' '));
  await shot(page, project, '07-dictation-typing');
  // Keyboard simulation: the iPad keyboard shrinks the visual viewport to ~60 % of the height;
  // the column is sized from --vvh, so setting it shows what she would see while typing.
  const vp = page.viewportSize()!;
  await page.evaluate((h) => document.documentElement.style.setProperty('--vvh', `${h}px`), Math.round(vp.height * 0.58));
  await shot(page, project, '07b-dictation-keyboard-sim');
  await page.evaluate((h) => document.documentElement.style.setProperty('--vvh', `${h}px`), vp.height);
  await dictateAtPace1(page, draft);
  await shot(page, project, '07c-dictation-finished');
  await page.getByTestId('btn-finish-writing').click();

  // ---- 08 Proofreading, stage 1, pass Verbes -----------------------------------------------
  await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('taisaient'); // reference still hidden
  await shot(page, project, '08-proofreading-verbes');
  // Tap "J'ai terminé" early to see the confirmation, then keep going.
  await page.getByTestId('btn-done-proofreading').click();
  await expect(page.getByText('Il reste des passes à faire')).toBeVisible();
  await shot(page, project, '08b-proofreading-confirm-early');
  await page.getByRole('button', { name: 'Continuer la relecture' }).click();
  // Word editor open on the wrong verb.
  await tok(page, 'taisait').first().click();
  await expect(page.getByTestId('word-editor')).toBeVisible();
  await shot(page, project, '10-proofreading-edit');
  await page.getByTestId('word-editor').fill('taisaient');
  await page.getByTestId('word-editor').press('Enter');
  await expect(tok(page, 'taisaient').first()).toBeVisible();

  // ---- 09 Pass Groupes nominaux -------------------------------------------------------------
  await page.getByTestId('btn-next-pass').click();
  await shot(page, project, '09-proofreading-gn');
  await editWord(page, 'endormi', 'endormis');

  // ---- 09b Pass Homophones ------------------------------------------------------------------
  await page.getByTestId('btn-next-pass').click();
  await shot(page, project, '09b-proofreading-homophones');
  await editWord(page, 'a', 'à');

  // ---- 09c Pass Mots-pièges (empty for a new profile) ---------------------------------------
  await page.getByTestId('btn-next-pass').click();
  await shot(page, project, '09c-proofreading-mots-pieges');

  // ---- 12 Chouette --------------------------------------------------------------------------
  await page.getByRole('button', { name: /Chouette d'Athéna/ }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await shot(page, project, '12-chouette');
  const hinted = (await page.locator('[data-testid^="tok-"].hint').allTextContents()).join(', ');
  notes.push(`Chouette pointed at: ${hinted}`);
  if (hinted.includes('ces')) await editWord(page, 'ces', 'ses');
  await editWord(page, 'atentive', 'attentive');
  // Introduce a mistake while proofreading (she "corrects" a correct word).
  await editWord(page, 'ouvrait', 'ouvrais');

  // ---- 11 Bouclier --------------------------------------------------------------------------
  await page.getByRole('button', { name: /Bouclier de Persée/ }).click();
  await expect(page.getByText(/en partant de la fin/)).toBeVisible();
  await shot(page, project, '11-bouclier');
  await page.getByRole('button', { name: /Phrase précédente/ }).click();
  await shot(page, project, '11b-bouclier-previous');
  await page.getByRole('button', { name: /Bouclier de Persée/ }).click();

  // ---- 10b Whole-text editor ---------------------------------------------------------------
  await page.getByRole('button', { name: /Modifier tout le texte/ }).click();
  await shot(page, project, '10b-proofreading-wholetext');
  await page.getByRole('button', { name: /Modifier tout le texte/ }).click();
  await shot(page, project, '10c-proofreading-before-done');

  // ---- 13 Results ---------------------------------------------------------------------------
  await page.getByTestId('btn-done-proofreading').click();
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  if (await confirm.isVisible()) await confirm.click();
  await expect(page.getByRole('heading', { name: 'Relecture terminée' })).toBeVisible();
  await expect(page.getByTestId('results-score')).not.toContainText('NaN');
  notes.push(`results: ${(await page.getByTestId('results-catch-rate').textContent())?.trim()} / ${(await page.getByTestId('results-score').textContent())?.trim()}`);
  await shot(page, project, '13-results');
  // Tap a still-wrong word, then a caught one.
  await page.locator('.results .tok.err').first().click();
  await expect(page.locator('.popover-panel')).toBeVisible();
  await shot(page, project, '14-results-explanation');
  notes.push(`explanation (missed): ${(await page.locator('.popover-panel').textContent())?.trim()}`);
  await page.locator('.results .tok.caught').first().click();
  await shot(page, project, '14b-results-caught');
  notes.push(`explanation (caught): ${(await page.locator('.popover-panel').textContent())?.trim()}`);
  notes.push(`Éris: ${(await page.locator('.eris-line').textContent())?.trim()}`);
  const expl = await page.locator('.category li').allTextContents();
  notes.push(`category explanations:\n  - ${expl.map((s) => s.replace(/\s+/g, ' ').trim()).join('\n  - ')}`);

  // ---- 15 Stats / 16 Settings ---------------------------------------------------------------
  await page.getByTestId('btn-back-library').click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  await shot(page, project, '15b-library-after-play');
  await page.locator('.topbar a[href$="/stats"]').click();
  await expect(page.getByRole('heading', { name: 'Progrès' })).toBeVisible();
  await expect(page.getByText(/1 parties?/).first()).toBeVisible();
  await shot(page, project, '15-stats');
  await page.locator('.topbar a[href$="/settings"]').click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
  await shot(page, project, '16-settings');

  // ---- 18-21 Paces 2, 3, 4 and the resume banner -------------------------------------------
  await page.goto(`/#/p/${profileId}/play/${paceText!.id}`);
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  await page.getByTestId('pace-option-2').click();
  await setSpeakMs(page, 3000);
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expect(page.getByTestId('dictation-textarea')).toBeVisible();
  await page.waitForTimeout(3200);
  await page.getByTestId('dictation-textarea').fill('Sur la plage de l\'île des Phéaciens,');
  await shot(page, project, '18-dictation-pace2');
  // Quitter (P1-4 fix): a confirm, then the resume banner, without losing the draft (P1-3 fix).
  await page.getByTestId('btn-quit-dictation').click();
  await expect(page.getByText('Ton brouillon est gardé')).toBeVisible();
  await page.getByTestId('btn-quit-confirm').click();
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeVisible();
  await shot(page, project, '19-resume-banner');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByTestId('dictation-textarea')).toBeVisible();
  notes.push(`draft after resume: ${JSON.stringify(await page.getByTestId('dictation-textarea').inputValue())}`);
  await page.goto(`/#/p/${profileId}/camp`);
  await page.locator('[data-testid="text-card"]', { hasText: PACE_TEXT_TITLE }).click();
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await page.getByTestId('pace-option-3').click();
  await setSpeakMs(page, 3000);
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expect(page.getByTestId('dictation-textarea')).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, project, '20-dictation-pace3');
  await page.getByRole('button', { name: 'Pause' }).click();
  await shot(page, project, '20b-dictation-pace3-paused');
  await page.goto(`/#/p/${profileId}/camp`);
  await page.locator('[data-testid="text-card"]', { hasText: PACE_TEXT_TITLE }).click();
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await page.getByTestId('pace-option-4').click();
  await setSpeakMs(page, 3000);
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expect(page.getByTestId('dictation-textarea')).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, project, '21-dictation-pace4');
  await page.goto(`/#/p/${profileId}/camp`);
  await page.locator('[data-testid="text-card"]', { hasText: PACE_TEXT_TITLE }).click();
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await page.goto(`/#/p/${profileId}/camp`);

  // ---- 22-24 Help stages 2, 3, 4 (profiles promoted through the API) -----------------------
  for (const stage of [2, 3, 4]) {
    const p = await createProfileApi(request, `Léa${stage}-${project}`);
    await promoteToStage(request, p.id, seed!.id, stage);
    await page.goto(`/#/p/${p.id}/play/${seed!.id}`);
    await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
    await page.getByTestId('pace-option-1').click();
    await page.getByRole('button', { name: 'Commencer la dictée' }).click();
    await dictateAtPace1(page, draft);
    await page.getByTestId('btn-finish-writing').click();
    await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
    await shot(page, project, `2${stage}-proofreading-stage${stage}`);
    notes.push(`stage ${stage} subtitle: ${(await page.locator('.proof .subtitle').textContent())?.trim()} | lit tokens: ${await page.locator('[data-testid^="tok-"].lit').count()} | dimmed: ${await page.locator('[data-testid^="tok-"].dim').count()}`);
    if (stage === 3) {
      await page.getByRole('button', { name: /Chouette d'Athéna/ }).click();
      await shot(page, project, '23b-proofreading-stage3-chouette');
    }
    if (stage === 4) {
      // Finish without fixing anything: the results screen for a fully missed text.
      await page.getByTestId('btn-done-proofreading').click();
      await expect(page.getByRole('heading', { name: 'Relecture terminée' })).toBeVisible();
      await shot(page, project, '24b-results-nothing-caught');
      notes.push(`Éris (nothing caught): ${(await page.locator('.eris-line').textContent())?.trim()}`);
    }
  }

  // ---- 17 PIN gate ------------------------------------------------------------------------
  await page.goto('/#/profiles/new');
  const pinName = `Max-${project}`;
  await page.getByLabel('Ton prénom').fill(pinName);
  await page.getByText('Trident', { exact: true }).click();
  await page.getByLabel('Ton niveau').selectOption('7H');
  await page.getByLabel(/Un code à quatre chiffres/).fill('1234');
  await shot(page, project, '02b-profile-new-with-code');
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  await shot(page, project, '03b-library-7H');
  await page.locator('.topbar a[href="#/"]').click();
  await expect(page.getByRole('heading', { name: 'La Discorde' })).toBeVisible();
  await shot(page, project, '01b-profiles-several');
  await page.getByRole('button', { name: new RegExp(pinName) }).click();
  await expect(page.getByRole('heading', { name: /Code de/ })).toBeVisible();
  await shot(page, project, '17-pin-gate');
  await page.getByLabel(/Code de/).fill('0000');
  await expect(page.getByText("Ce n'est pas le bon code")).toBeVisible();
  await shot(page, project, '17b-pin-gate-wrong');
  await page.getByLabel(/Code de/).fill('1234');
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();

  console.log(`\n===== NOTES ${project} =====\n${notes.join('\n')}\n`);
});
