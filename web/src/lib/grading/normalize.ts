const APOSTROPHES = /[’ʼ‘′]/g;
const DQUOTES = /[“”„″]/g;
const NBSP = /[   ]/g; // no-break, narrow no-break, figure space — written as escapes, not literal invisible characters

export function caseNormalizeWord(s: string): string {
  return s
    .replace(APOSTROPHES, "'")
    .replace(DQUOTES, '"')
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
