import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { VOICES, erisSays } from './voices';

describe('overlay voices (Ruling W2, W10)', () => {
  it('gives every overlay line a speaker with a painted portrait', () => {
    for (const [id, line] of Object.entries(VOICES)) {
      expect(['owl', 'pythia', 'eris', 'dragon'], id).toContain(line.speaker);
      expect(existsSync('public' + line.portrait), id).toBe(true);
    }
  });

  it('keeps each line short, neutral and free of form plurals', () => {
    for (const [id, line] of Object.entries(VOICES)) {
      expect(line.text.length, id).toBeLessThanOrEqual(160);
      expect(line.text, id).not.toMatch(/\bhéros\b/i);
      expect(line.text, id).not.toMatch(/\((s|x|e|es)\)/);
    }
  });

  it('turns the old instruction paragraphs into the owl and the Pythia speaking', () => {
    expect(VOICES.desk.text).toBe("Hou ! Entre 80 et 200 mots, c'est l'idéal, et les nombres en lettres.");
    expect(VOICES.lens.text).toContain('une photo par page');
    expect(VOICES.pythia.speaker).toBe('pythia');
  });

  it('lets Éris speak in the war tent with her smug portrait', () => {
    expect(erisSays('Dossier ouvert.')).toEqual({ speaker: 'eris', name: 'Éris', portrait: '/art/characters/eris_smug_cut.webp', text: 'Dossier ouvert.' });
    expect(VOICES.bestiary.speaker).toBe('owl');
  });
});
