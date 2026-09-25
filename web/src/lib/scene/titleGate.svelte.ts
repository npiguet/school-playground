// Whether « Entrer » was tapped during this page load (UI3 Ruling A4): the gate stays open when
// the player comes back to the title (« Changer de héros »); a reload closes it again.
export const titleGate = $state({ entered: false });
