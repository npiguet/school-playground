// Shared types for the grading engine (spec §3.5).
// This is the single source of truth for `ArgusPass`: Task 11's `argus.ts` and
// Task 9's `types.ts` import/re-export it rather than redeclaring it.

export type Category = 'homophone' | 'agreement' | 'accent' | 'punctuation_case' | 'lexical';
export type AgreementSub = 'number' | 'gender' | 'verb' | 'participle';
export type ErrorSub = AgreementSub | 'verb_ending' | 'missing' | 'extra';

export interface Token {
  text: string;
  norm: string;
  caseNorm: string;
  start: number;
  end: number;
  kind: 'word' | 'punct';
}

export interface AlignedPair {
  refIndex: number | null;
  typedIndex: number | null;
}

export interface TokenError {
  refIndex: number | null;
  typedIndex: number | null;
  expected: string | null;
  typed: string | null;
  category: Category;
  sub?: ErrorSub;
  homophoneSet?: string;
  anchor: number; // refIndex of the nearest preceding aligned reference token (-1 at start); used to key extra words
}

export interface AnnotToken {
  i: number;
  text: string;
  start: number;
  end: number;
  lemma: string;
  pos: string;
  morph: Record<string, string>;
  head: number;
  dep: string;
  categories: string[];
  homophone: string | null;
  subject: number | null;
}

export interface Annotation {
  version: number;
  model: string;
  tokens: AnnotToken[];
  sentences: { start: number; end: number }[];
}

export interface GradeResult {
  refTokens: Token[];
  typedTokens: Token[];
  pairs: AlignedPair[];
  errors: TokenError[];
  correctWords: number;
  totalWords: number;
}

export type StatKey =
  | 'agreement:verb'
  | 'agreement:participle'
  | 'agreement:number'
  | 'agreement:gender'
  | 'agreement:other'
  | 'homophone'
  | 'accent'
  | 'punctuation_case'
  | 'lexical';

// Single source of truth for ArgusPass too (Task 11's argus.ts and Task 9's types.ts
// import/re-export this — do not redeclare it).
export type ArgusPass = 'verbes' | 'groupes_nominaux' | 'homophones' | 'mots_pieges';

export interface CategoryStat {
  opportunities: number;
  draft: number;
  caught: number;
  missed: number;
  introduced: number;
}

export interface SessionResult {
  version: 1;
  byCategory: Partial<Record<StatKey, CategoryStat>>;
  draftErrors: TokenError[];
  finalErrors: TokenError[];
  caught: TokenError[];
  missed: TokenError[];
  introduced: TokenError[];
  correctWords: number;
  totalWords: number;
  catchRate: number | null;
  score: number;
}
