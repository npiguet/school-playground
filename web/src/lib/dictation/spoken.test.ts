import { describe, it, expect } from 'vitest';
import { spokenForm } from './spoken';

describe('spokenForm', () => {
  // Spec 2026-09-27 §2, bake-off variant C (Ruling K2): a sentence-ending mark is kept and followed by
  // its capitalised name; « ; » and « : » are kept, their name in lower case; the rest as before.
  it('keeps a final full stop and says its name after it', () => {
    expect(spokenForm('Le loup, affamé, arriva.')).toBe('Le loup, virgule, affamé, virgule, arriva. Point.');
  });
  it('does the same for every sentence-ending mark, wherever it is', () => {
    expect(spokenForm('Est-ce que tu sais leurs noms, berger ?')).toBe("Est-ce que tu sais leurs noms, virgule, berger ? Point d'interrogation.");
    expect(spokenForm('Que la campagne était belle !')).toBe("Que la campagne était belle ! Point d'exclamation.");
    expect(spokenForm("Jamais je n'en avais tant vu…")).toBe("Jamais je n'en avais tant vu… Points de suspension.");
    expect(spokenForm('Pourquoi… pourquoi ?')).toBe("Pourquoi… Points de suspension, pourquoi ? Point d'interrogation.");
    expect(spokenForm('Et puis...')).toBe('Et puis… Points de suspension.');
  });
  it('keeps « ; » and « : » before their name, in lower case', () => {
    expect(spokenForm('Il dit : « Viens ici ! »'))
      .toBe("Il dit : deux-points, ouvrez les guillemets, Viens ici ! Point d'exclamation, fermez les guillemets.");
    expect(spokenForm('dit la petite chèvre ; et elle')).toBe('dit la petite chèvre ; point-virgule, et elle.');
  });
  it('reads the bake-off sentences exactly as the user heard them (round2.json, variant C)', () => {
    expect(spokenForm("Un matin, l'œuf se fendit en craquant, et un petit dragon aux écailles vertes en sortit, les ailes encore froissées."))
      .toBe("Un matin, virgule, l'œuf se fendit en craquant, virgule, et un petit dragon aux écailles vertes en sortit, virgule, les ailes encore froissées. Point.");
    expect(spokenForm('Sur la pomme, quelques mots étaient gravés : « À la plus belle. »'))
      .toBe('Sur la pomme, virgule, quelques mots étaient gravés : deux-points, ouvrez les guillemets, À la plus belle. Point, fermez les guillemets.');
  });
  it('capitalises a punctuation name right after « À la ligne. », never a word', () => {
    expect(spokenForm("— Déjà ! dit la petite chèvre ; et elle s'arrêta fort étonnée.", { newParagraph: true }))
      .toBe("À la ligne. Tiret, Déjà ! Point d'exclamation, dit la petite chèvre ; point-virgule, et elle s'arrêta fort étonnée. Point.");
    expect(spokenForm('Il partit.', { newParagraph: true })).toBe('À la ligne. Il partit. Point.');
    expect(spokenForm('Mme Loisel dansait.', { newParagraph: true })).toBe('À la ligne. madame Loisel dansait. Point.');
  });
  it('keeps the comma, the guillemets and the tiret as they were', () => {
    expect(spokenForm('Le loup, affamé,')).toBe('Le loup, virgule, affamé, virgule.');
  });
  it('never speaks apostrophes or hyphens inside words', () => {
    expect(spokenForm("L'enfant a dit peut-être.")).toBe("L'enfant a dit peut-être. Point.");
  });
  it('leaves the abbreviations alone: « M. » is « monsieur », « Mme » « madame »', () => {
    expect(spokenForm('Elle rencontra M. Seguin.')).toBe('Elle rencontra monsieur Seguin. Point.');
    expect(spokenForm('Mme Loisel dansait.')).toBe('madame Loisel dansait. Point.');
  });
  // Pace-bug report, open item 2: a group cut in the middle of its sentence, on a word, goes on; a full
  // stop would make the voice close a phrase that is not finished. It ends with a bare comma instead.
  it('ends a group that stops on a word inside its sentence with a comma, not a full stop', () => {
    expect(spokenForm("Quand les marins d'Ulysse débarquèrent sur l'île boisée", { continues: true }))
      .toBe("Quand les marins d'Ulysse débarquèrent sur l'île boisée,");
    expect(spokenForm('Celui-ci, protégé par une herbe magique', { continues: true }))
      .toBe('Celui-ci, virgule, protégé par une herbe magique,');
    expect(spokenForm('les invita dans son palais', { continues: true, newParagraph: true }))
      .toBe('À la ligne. les invita dans son palais,');
  });
  it("keeps the ending of a group that stops on the text's own punctuation, and of a whole sentence", () => {
    expect(spokenForm('où régnait la magicienne Circé,', { continues: true })).toBe('où régnait la magicienne Circé, virgule.');
    expect(spokenForm('dit la petite chèvre ;', { continues: true })).toBe('dit la petite chèvre ; point-virgule.');
    expect(spokenForm('qui les frôlaient sans jamais montrer les crocs.', { continues: false }))
      .toBe('qui les frôlaient sans jamais montrer les crocs. Point.');
    expect(spokenForm('Fin du premier')).toBe('Fin du premier.');
  });
});
