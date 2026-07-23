export const CHORD_PATTERNS = [
  { suffix: "", intervals: [0, 4, 7] },
  { suffix: "m", intervals: [0, 3, 7] },
  { suffix: "dim", intervals: [0, 3, 6] },
  { suffix: "aug", intervals: [0, 4, 8] },
  { suffix: "sus4", intervals: [0, 5, 7] },
  { suffix: "sus2", intervals: [0, 2, 7] },
  { suffix: "7sus", intervals: [0, 2, 7, 10] },
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
  { suffix: "6/9♯11", intervals: [0, 4, 7, 9, 2, 6] },
  { suffix: "m6/9", intervals: [0, 3, 7, 9, 2] },
  { suffix: "maj9", intervals: [0, 4, 7, 11, 2] },
  { suffix: "9", intervals: [0, 4, 7, 10, 2] },
  { suffix: "m9", intervals: [0, 3, 7, 10, 2] },
  { suffix: "m11", intervals: [0, 3, 7, 10, 2, 5] },
  // Practical minor-11 voicing: the defining minor 3rd and minor 7th are
  // present, while the 9th may be omitted beneath the 11th.
  { suffix: "m11", intervals: [0, 3, 7, 10, 5] },
  // Practical minor-13 voicing: the 9th is commonly omitted while the 11th
  // and 13th carry the extended color.
  { suffix: "m13", intervals: [0, 3, 7, 10, 5, 9] },
  { suffix: "maj13", intervals: [0, 4, 7, 11, 2, 9] },
  { suffix: "maj13♯11", intervals: [0, 4, 7, 11, 2, 6, 9] },
  { suffix: "13", intervals: [0, 4, 7, 10, 2, 9] },
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

export function analyzeVoicingOptions(midis, { includeUnplayedRoots = false } = {}) {
  if (!midis || midis.length < 2) return [];
  const pcs = new Set(midis.map(midi => ((midi % 12) + 12) % 12));
  const bassPc = ((midis[0] % 12) + 12) % 12;
  const options = [];

  for (let root = 0; root < 12; root++) {
    const fifthPc = (root + 7) % 12;
    let bestForRoot = null;
    for (const { suffix, intervals, requiresRoot = false } of CHORD_PATTERNS) {
      const chordSet = new Set(intervals.map(interval => (root + interval) % 12));
      if ([...pcs].some(pc => !chordSet.has(pc))) continue;

      const missing = [...chordSet].filter(pc => !pcs.has(pc));
      if (missing.some(pc => pc !== root && pc !== fifthPc)) continue;

      const missingRoot = missing.includes(root);
      if (requiresRoot && missingRoot) continue;
      const missingFifth = missing.includes(fifthPc);
      const tier = missing.length === 0 ? 0 : missingRoot ? (missingFifth ? 3 : 2) : 1;
      const score = [tier, intervals.length];
      const hasPlayedThird = [3, 4].some(interval =>
        intervals.includes(interval) && pcs.has((root + interval) % 12)
      );
      const hasPlayedSeventh = [10, 11].some(interval =>
        intervals.includes(interval) && pcs.has((root + interval) % 12)
      );

      if (!bestForRoot || score.some((value, index) =>
        value < bestForRoot.score[index] && score.slice(0, index).every((earlier, i) => earlier === bestForRoot.score[i])
      )) {
        bestForRoot = {
          rootPc: root,
          suffix,
          rootless: missingRoot,
          hasPlayedThird,
          hasPlayedSeventh,
          score,
        };
      }
    }
    if (bestForRoot) options.push(bestForRoot);
  }

  options.sort((a, b) => {
    const aThirdAndSeventh = a.hasPlayedThird && a.hasPlayedSeventh ? 0 : 1;
    const bThirdAndSeventh = b.hasPlayedThird && b.hasPlayedSeventh ? 0 : 1;
    const aThird = a.hasPlayedThird ? 0 : 1;
    const bThird = b.hasPlayedThird ? 0 : 1;
    const aSeventh = a.hasPlayedSeventh ? 0 : 1;
    const bSeventh = b.hasPlayedSeventh ? 0 : 1;
    const aBass = a.rootPc === bassPc ? 0 : 1;
    const bBass = b.rootPc === bassPc ? 0 : 1;
    return aThirdAndSeventh - bThirdAndSeventh ||
      a.score[0] - b.score[0] || aThird - bThird || aSeventh - bSeventh ||
      aBass - bBass || a.score[1] - b.score[1];
  });
  if (includeUnplayedRoots) return options;

  const enteredRootOptions = options.filter(option => pcs.has(option.rootPc));
  // Prefer any recognized chord name over a generated interval list. The bass
  // still wins when it is one of the recognized roots because `options` was
  // sorted that way above; otherwise the best conventional analysis leads.
  if (enteredRootOptions.length > 0) return enteredRootOptions;

  // Use an interval description only when the registry has no conventional
  // chord name rooted on any of the notes in the voicing.
  const intervalNames = ["", "♭9", "9", "♭3", "3", "11", "♯11", "5", "♭13", "13", "♭7", "maj7"];
  const relativeIntervals = [...pcs]
    .map(pc => (pc - bassPc + 12) % 12)
    .filter(interval => interval !== 0)
    .sort((a, b) => a - b);
  const fallback = {
    rootPc: bassPc,
    suffix: `(${relativeIntervals.map(interval => intervalNames[interval]).join(",")})`,
    rootless: false,
    fallback: true,
    score: [99, 99],
  };
  return [fallback, ...enteredRootOptions];
}

export function analyzeVoicing(midis) {
  return analyzeVoicingOptions(midis)[0] || null;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function chordLabel(midis, names = NOTE_NAMES) {
  const analysis = analyzeVoicing(midis);
  if (!analysis) return null;
  return names[analysis.rootPc] + analysis.suffix + (analysis.rootless ? " (rootless)" : "");
}

export function chordLabels(midis, names = NOTE_NAMES) {
  return analyzeVoicingOptions(midis).map(analysis =>
    names[analysis.rootPc] + analysis.suffix + (analysis.rootless ? " (rootless)" : "")
  );
}
