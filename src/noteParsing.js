const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// One practical key spelling for each pitch class. Deliberately use G♭, D♭,
// and B rather than the excluded F♯, C♯, and C♭ keys.
export const KEY_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export function keyUsesFlats(rootPc) {
  return [1, 3, 5, 6, 8, 10].includes(rootPc);
}

export function spellMidiForChord(midi, rootPc, suffix = "") {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const naturalPcs = [0, 2, 4, 5, 7, 9, 11];
  const rootName = KEY_NAMES[rootPc];
  const rootLetterIndex = letters.indexOf(rootName[0]);
  const interval = ((midi - rootPc) % 12 + 12) % 12;
  const degreeByInterval = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
  let degree = degreeByInterval[interval];
  if (interval === 6 && /b5/.test(suffix)) degree = 4;
  if (interval === 8 && /#5|aug/.test(suffix)) degree = 4;
  const letterIndex = (rootLetterIndex + degree) % 7;
  const naturalPc = naturalPcs[letterIndex];
  const targetPc = ((midi % 12) + 12) % 12;
  let accidentalDistance = (targetPc - naturalPc + 12) % 12;
  if (accidentalDistance > 6) accidentalDistance -= 12;
  const accidental = accidentalDistance === -2 ? "𝄫"
    : accidentalDistance === -1 ? "♭"
    : accidentalDistance === 1 ? "♯"
    : accidentalDistance === 2 ? "𝄪"
    : "";
  const octave = Math.floor(midi / 12) - 1;
  return letters[letterIndex] + accidental + octave;
}

export function normalizeVoicingSpelling(text, midis, rootPc, suffix = "") {
  const preserveOctaves = text.split(/[\s,]+/).filter(Boolean)
    .some(token => /-?\d+$/.test(token));
  return midis.map(midi => {
    const spelled = spellMidiForChord(midi, rootPc, suffix);
    return preserveOctaves ? spelled : spelled.replace(/-?\d+$/, "");
  }).join(" ");
}

function parseNoteToken(str) {
  const match = str.trim().match(/^([A-Ga-g])((?:#{1,2}|♯{1,2}|b{1,2}|♭{1,2}|𝄪|𝄫)?)(-?\d+)?$/);
  if (!match) return null;

  const [, letter, accidental, octaveText] = match;
  let pitchClass = PC[letter.toUpperCase()];
  if (accidental === "𝄪") pitchClass += 2;
  else if (accidental === "𝄫") pitchClass -= 2;
  else if (accidental) {
    const direction = accidental[0] === "#" || accidental[0] === "♯" ? 1 : -1;
    pitchClass += direction * accidental.length;
  }

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

export function inferUseFlats(text, rootPc = null) {
  const accidental = text.match(/[#♯b♭]/)?.[0];
  if (accidental) return accidental === "b" || accidental === "♭";

  // With natural-note input, use the conventional spelling associated with
  // the analyzed root rather than forcing every accidental one direction.
  return keyUsesFlats(rootPc);
}
