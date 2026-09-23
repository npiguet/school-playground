import { tokenize } from './tokenize';
import { alignTokens } from './align';
import { classifyPair } from './classify';
import { mapAnnotation, refCategories } from './annotationMap';
import { normalizeWord, stripDiacritics } from './normalize';
import type {
  Annotation,
  AnnotToken,
  CategoryStat,
  GradeResult,
  SessionResult,
  StatKey,
  Token,
  TokenError,
} from './types';

const PACE_MULTIPLIERS = [1, 1.25, 1.5, 2];

const STAT_KEYS: StatKey[] = [
  'agreement:verb',
  'agreement:participle',
  'agreement:number',
  'agreement:gender',
  'agreement:other',
  'homophone',
  'accent',
  'punctuation_case',
  'lexical',
];

export function gradeText(reference: string, typed: string, annotation: Annotation | null): GradeResult {
  const refTokens = tokenize(reference);
  const typedTokens = tokenize(typed);
  const pairs = alignTokens(refTokens, typedTokens);
  const annots = mapAnnotation(refTokens, annotation);
  const errors: TokenError[] = [];
  let anchor = -1;
  for (const p of pairs) {
    const ref = p.refIndex === null ? null : refTokens[p.refIndex];
    const t = p.typedIndex === null ? null : typedTokens[p.typedIndex];
    const e = classifyPair(ref, t, p.refIndex === null ? undefined : annots[p.refIndex], anchor);
    if (e) {
      e.refIndex = p.refIndex;
      e.typedIndex = p.typedIndex;
      errors.push(e);
    }
    if (p.refIndex !== null) anchor = p.refIndex;
  }
  const totalWords = refTokens.filter((x) => x.kind === 'word').length;
  const wrongRef = new Set(errors.filter((e) => e.refIndex !== null).map((e) => e.refIndex));
  const correctWords = refTokens.filter((x, i) => x.kind === 'word' && !wrongRef.has(i)).length;
  return { refTokens, typedTokens, pairs, errors, correctWords, totalWords };
}

export function errorKey(e: TokenError): string {
  if (e.refIndex !== null) return `r${e.refIndex}`;
  return `x${e.anchor}:${normalizeWord(e.typed ?? '')}`;
}

export function statKey(e: TokenError): StatKey {
  if (e.category === 'agreement') return `agreement:${e.sub ?? 'other'}` as StatKey;
  return e.category;
}

export function computeScore(correctWords: number, caughtCount: number, catchRate: number | null, paceLevel: number): number {
  const bonus = catchRate === null ? 50 : Math.round(100 * catchRate);
  const multiplier = PACE_MULTIPLIERS[paceLevel - 1];
  return Math.round((2 * correctWords + 20 * caughtCount + bonus) * multiplier);
}

function computeOpportunities(refTokens: Token[], annots: (AnnotToken | undefined)[]): Record<StatKey, number> {
  const counts: Record<StatKey, number> = {
    'agreement:verb': 0,
    'agreement:participle': 0,
    'agreement:number': 0,
    'agreement:gender': 0,
    'agreement:other': 0,
    homophone: 0,
    accent: 0,
    punctuation_case: 0,
    lexical: 0,
  };
  refTokens.forEach((t, i) => {
    if (t.kind === 'punct') {
      counts.punctuation_case++;
      return;
    }
    counts.lexical++;
    const cats = refCategories(annots[i]);
    if (cats.includes('verb')) counts['agreement:verb']++;
    if (cats.includes('participle')) counts['agreement:participle']++;
    if (cats.includes('nominal_group')) {
      counts['agreement:number']++;
      counts['agreement:gender']++;
    }
    if (cats.includes('homophone')) counts.homophone++;
    if (t.norm !== stripDiacritics(t.norm)) counts.accent++;
    if (/^\p{Lu}/u.test(t.text)) counts.punctuation_case++;
  });
  return counts;
}

function buildByCategory(
  opportunities: Record<StatKey, number>,
  draftErrors: TokenError[],
  caught: TokenError[],
  missed: TokenError[],
  introduced: TokenError[],
): Partial<Record<StatKey, CategoryStat>> {
  const byCategory: Partial<Record<StatKey, CategoryStat>> = {};
  for (const key of STAT_KEYS) {
    byCategory[key] = {
      opportunities: opportunities[key],
      draft: draftErrors.filter((e) => statKey(e) === key).length,
      caught: caught.filter((e) => statKey(e) === key).length,
      missed: missed.filter((e) => statKey(e) === key).length,
      introduced: introduced.filter((e) => statKey(e) === key).length,
    };
  }
  return byCategory;
}

export function gradeSession(
  reference: string,
  draft: string,
  final: string,
  annotation: Annotation | null,
  { paceLevel }: { paceLevel: number },
): SessionResult {
  const draftGrade = gradeText(reference, draft, annotation);
  const finalGrade = gradeText(reference, final, annotation);
  const draftErrors = draftGrade.errors;
  const finalErrors = finalGrade.errors;

  const draftMap = new Map(draftErrors.map((e) => [errorKey(e), e]));
  const finalMap = new Map(finalErrors.map((e) => [errorKey(e), e]));

  const caught = draftErrors.filter((e) => !finalMap.has(errorKey(e)));
  const missed = draftErrors
    .filter((e) => finalMap.has(errorKey(e)))
    .map((e) => {
      const finalError = finalMap.get(errorKey(e))!;
      return { ...e, typed: finalError.typed, typedIndex: finalError.typedIndex };
    });
  const introduced = finalErrors.filter((e) => !draftMap.has(errorKey(e)));

  const catchRate = draftErrors.length ? caught.length / draftErrors.length : null;

  const refTokens = tokenize(reference);
  const annots = mapAnnotation(refTokens, annotation);
  const opportunities = computeOpportunities(refTokens, annots);
  const byCategory = buildByCategory(opportunities, draftErrors, caught, missed, introduced);

  return {
    version: 1,
    byCategory,
    draftErrors,
    finalErrors,
    caught,
    missed,
    introduced,
    correctWords: finalGrade.correctWords,
    totalWords: finalGrade.totalWords,
    catchRate,
    score: computeScore(finalGrade.correctWords, caught.length, catchRate, paceLevel),
  };
}
