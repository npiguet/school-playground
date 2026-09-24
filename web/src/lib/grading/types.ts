// Shared types for the grading engine (spec §3.5).
// This is the single source of truth for `ArgusPass`: Task 11's `argus.ts` and
// Task 9's `types.ts` import/re-export it rather than redeclaring it.

export type Category = 'homophone' | 'agreement' | 'accent' | 'punctuation_case' | 'lexical';
export type AgreementSub = 'number' | 'gender' | 'verb' | 'participle';
export type ErrorSub = AgreementSub | 'verb_ending' | 'missing' | 'extra' | 'sound_alike';

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

// Annotation v2 additions (SP2 Task 6). `forms` maps sibling inflections of the reference
// token's lemma (lowercase, never the token itself) to their gender/number features, so the
// client can classify an irregular agreement error (e.g. "chevaux" -> "cheval") without
// shipping the lexicon. `sound_alikes` lists same-pronunciation, different-spelling words
// (excluding forms and homophone-set members) for the lexical sound-alike sub-category.
// `chains` are ids into the top-level `Annotation.chains` list (Fil d'Ariane / explanations);
// SP2 Task 6 only carries the shape through — chain-aware grading lands in a later task.
export interface FormFeatures {
  g: 'm' | 'f' | null;
  n: 's' | 'p' | null;
}

export type ChainKind = 'subject_verb' | 'nominal' | 'attribute' | 'participle_etre' | 'participle_avoir';
export type Confidence = 'high' | 'medium' | 'low';

export interface Chain {
  id: number;
  kind: ChainKind;
  controller: number;
  controller_group: number[];
  targets: number[];
  via: 'qui' | 'conj' | 'aux' | 'que' | null;
  via_token: number | null;
  features: Record<string, string>;
  confidence: Confidence;
  distance: number;
  rule: 'no_agreement' | 'cod_before' | null;
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
  forms?: Record<string, FormFeatures>;
  sound_alikes?: string[];
  chains?: number[];
}

export interface Annotation {
  version: number;
  model: string;
  tokens: AnnotToken[];
  sentences: { start: number; end: number }[];
  chains?: Chain[];
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
  /** Tool usage for this session (SP2 Task 7): Chouette hints and Fil d'Ariane threads. */
  tools?: { hints: number; threadsDrawn: number; threadsCorrect: number };
}
