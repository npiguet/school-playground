import { describe, it, expect } from 'vitest';
import { spokenForm } from './spoken';

describe('spokenForm', () => {
  it('speaks commas and the final period', () => {
    expect(spokenForm('Le loup, affamé, arriva.')).toBe('Le loup, virgule, affamé, virgule, arriva, point.');
  });
  it('speaks colons, quotes and exclamation marks like a teacher', () => {
    expect(spokenForm('Il dit : « Viens ici ! »'))
      .toBe("Il dit, deux-points, ouvrez les guillemets, Viens ici, point d'exclamation, fermez les guillemets.");
  });
  it('speaks ellipses and question marks', () => {
    expect(spokenForm('Pourquoi… pourquoi ?')).toBe("Pourquoi, points de suspension, pourquoi, point d'interrogation.");
  });
  it('never speaks apostrophes or hyphens inside words', () => {
    expect(spokenForm("L'enfant a dit peut-être.")).toBe("L'enfant a dit peut-être, point.");
  });
  it('announces new paragraphs', () => {
    expect(spokenForm('Il partit.', { newParagraph: true })).toBe('À la ligne. Il partit, point.');
  });
  it('adds a final period to a chunk without terminal punctuation', () => {
    expect(spokenForm('Le loup, affamé,')).toBe('Le loup, virgule, affamé, virgule.');
  });
  it('reads "M." as "monsieur", swallowing the abbreviation period', () => {
    expect(spokenForm('Elle rencontra M. Seguin.')).toBe('Elle rencontra monsieur Seguin, point.');
  });
  it('reads "Mme" as "madame"', () => {
    expect(spokenForm('Mme Loisel dansait.')).toBe('madame Loisel dansait, point.');
  });
});
