export const CHORD_PATTERNS = [
  { suffix: "", intervals: [0, 4, 7] },
  { suffix: "m", intervals: [0, 3, 7] },
  { suffix: "dim", intervals: [0, 3, 6] },
  { suffix: "aug", intervals: [0, 4, 8] },
  { suffix: "sus4", intervals: [0, 5, 7] },
  { suffix: "sus2", intervals: [0, 2, 7] },
  { suffix: "add9", intervals: [0, 4, 7, 2] },
  { suffix: "m add9", intervals: [0, 3, 7, 2] },
  { suffix: "6", intervals: [0, 4, 7, 9] },
  { suffix: "m6", intervals: [0, 3, 7, 9] },
  { suffix: "maj7", intervals: [0, 4, 7, 11] },
  { suffix: "7", intervals: [0, 4, 7, 10] },
  { suffix: "m7", intervals: [0, 3, 7, 10] },
  { suffix: "m7b5", intervals: [0, 3, 6, 10] },
  { suffix: "dim7", intervals: [0, 3, 6, 9] },
  { suffix: "m(maj7)", intervals: [0, 3, 7, 11] },
  { suffix: "m(maj7)b5", intervals: [0, 3, 6, 11] },
  { suffix: "aug maj7", intervals: [0, 4, 8, 11] },
  { suffix: "6/9", intervals: [0, 4, 7, 9, 2] },
  { suffix: "m6/9", intervals: [0, 3, 7, 9, 2] },
  { suffix: "maj9", intervals: [0, 4, 7, 11, 2] },
  { suffix: "9", intervals: [0, 4, 7, 10, 2] },
  { suffix: "m9", intervals: [0, 3, 7, 10, 2] },
  { suffix: "7b5", intervals: [0, 4, 6, 10], requiresRoot: true },
  { suffix: "7#5", intervals: [0, 4, 8, 10], requiresRoot: true },
  { suffix: "7b9", intervals: [0, 4, 7, 10, 1], requiresRoot: true },
  { suffix: "7#9", intervals: [0, 4, 7, 10, 3], requiresRoot: true },
  { suffix: "7b5b9", intervals: [0, 4, 6, 10, 1], requiresRoot: true },
  { suffix: "7b5#9", intervals: [0, 4, 6, 10, 3], requiresRoot: true },
  { suffix: "7#5b9", intervals: [0, 4, 8, 10, 1], requiresRoot: true },
  { suffix: "7#5#9", intervals: [0, 4, 8, 10, 3], requiresRoot: true },
  { suffix: "maj7♯11", intervals: [0, 4, 7, 11, 6] },
  { suffix: "7♯11", intervals: [0, 4, 7, 10, 6] },
];

// Candidate generation and recognition deliberately share this registry.
export const QUALITIES = CHORD_PATTERNS.map(({ suffix, intervals }) => [suffix, intervals]);

export function analyzeVoicing(midis) {
  if (!midis || midis.length < 2) return null;
  const pcs = new Set(midis.map(midi => ((midi % 12) + 12) % 12));
  const bassPc = ((midis[0] % 12) + 12) % 12;
  let best = null;

  for (let root = 0; root < 12; root++) {
    const fifthPc = (root + 7) % 12;
    for (const { suffix, intervals, requiresRoot = false } of CHORD_PATTERNS) {
      const chordSet = new Set(intervals.map(interval => (root + interval) % 12));
      if ([...pcs].some(pc => !chordSet.has(pc))) continue;

      const missing = [...chordSet].filter(pc => !pcs.has(pc));
      if (missing.some(pc => pc !== root && pc !== fifthPc)) continue;

      const missingRoot = missing.includes(root);
      if (requiresRoot && missingRoot) continue;
      const missingFifth = missing.includes(fifthPc);
      const tier = missing.length === 0 ? 0 : missingRoot ? (missingFifth ? 3 : 2) : 1;
      const bassPenalty = !missingRoot && bassPc === root ? 0 : 1;
      const score = [tier, bassPenalty, intervals.length];

      if (!best || score.some((value, index) =>
        value < best.score[index] && score.slice(0, index).every((earlier, i) => earlier === best.score[i])
      )) {
        best = { rootPc: root, suffix, rootless: missingRoot, score };
      }
    }
  }
  return best;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function chordLabel(midis, names = NOTE_NAMES) {
  const analysis = analyzeVoicing(midis);
  if (!analysis) return null;
  return names[analysis.rootPc] + analysis.suffix + (analysis.rootless ? " (rootless)" : "");
}
