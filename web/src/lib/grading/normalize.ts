const APOSTROPHES = /[’ʼ‘′]/g;
const DQUOTES = /[“”„″]/g;
// Typographic punctuation variants the iPad keyboard can't easily produce are not graded
// (spec §3.5 "typographic apostrophes/quotes unified"): guillemets fold into straight double
// quotes, the single ellipsis glyph folds into three dots, and en/em dashes and the Unicode
// hyphen fold into the plain ASCII hyphen-minus.
const GUILLEMETS = /[«»‹›]/g;
const ELLIPSIS_CHAR = /…/g;
const DASHES = /[—–‐]/g;
const NBSP = /[\u00A0\u202F\u2007]/g; // no-break, narrow no-break, figure space — written as escapes, not literal invisible characters

export function caseNormalizeWord(s: string): string {
  return s
    .replace(APOSTROPHES, "'")
    .replace(DQUOTES, '"')
    .replace(GUILLEMETS, '"')
    .replace(ELLIPSIS_CHAR, '...')
    .replace(DASHES, '-')
    .replace(NBSP, ' ')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'Oe')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'Ae')
    .trim();
}

export function normalizeWord(s: string): string {
  return caseNormalizeWord(s).toLowerCase();
}

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}
