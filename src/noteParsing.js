const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function parseNoteToken(str) {
  const match = str.trim().match(/^([A-Ga-g])([#♯b♭]?)(-?\d+)?$/);
  if (!match) return null;

  const [, letter, accidental, octaveText] = match;
  let pitchClass = PC[letter.toUpperCase()];
  if (accidental === "#" || accidental === "♯") pitchClass += 1;
  if (accidental === "b" || accidental === "♭") pitchClass -= 1;

  return {
    pitchClass: ((pitchClass % 12) + 12) % 12,
    octave: octaveText === undefined ? null : parseInt(octaveText, 10),
  };
}

export function parseVoicing(text) {
  const tokens = text.split(/[\s,]+/).filter(Boolean);
  const notes = [];
  const invalidTokens = [];

  for (const token of tokens) {
    const note = parseNoteToken(token);
    if (!note) invalidTokens.push(token);
    else notes.push(note);
  }

  const hasOctaves = notes.some(note => note.octave !== null);
  const hasMissingOctaves = notes.some(note => note.octave === null);
  const mixedOctaves = hasOctaves && hasMissingOctaves;

  if (mixedOctaves) {
    return { midis: [], invalidTokens, mixedOctaves: true };
  }

  const midis = hasOctaves
    ? notes.map(note => (note.octave + 1) * 12 + note.pitchClass)
    : notes.reduce((normalized, note) => {
        let midi = 48 + note.pitchClass; // first occurrence in octave 3
        const previous = normalized[normalized.length - 1];
        while (previous !== undefined && midi < previous) midi += 12;
        normalized.push(midi);
        return normalized;
      }, []);

  return { midis, invalidTokens, mixedOctaves: false };
}
