import { analyzeVoicingOptions } from "./chordPatterns.js";

const CONVENTIONAL_ROOT_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const FLAT_ROOTS = new Set([3, 8, 10]);

// Reflect a voicing around its first note. The pivot remains fixed and every
// interval above it moves the same absolute distance below it.
export function negativeHarmony(midis) {
  if (!midis || midis.length === 0) return [];
  const pivot = midis[0];
  return midis
    .map(midi => pivot - (midi - pivot))
    .sort((a, b) => a - b);
}

// Shadow harmony can land in an inversion, so its harmonic root must come from
// the complete pitch set rather than from the lowest reflected note. Chord
// roots use conventional spellings independently of the keyboard-note setting.
export function negativeHarmonyAnalysis(midis) {
  const recognized = analyzeVoicingOptions(midis, { includeUnplayedRoots: true })
    .filter(option => !option.fallback)
    .sort((a, b) =>
      Number(a.rootless) - Number(b.rootless) ||
      (a.rootless && b.rootless
        ? b.score[1] - a.score[1]
        : a.score[0] - b.score[0] || a.score[1] - b.score[1])
    )[0];
  return recognized || analyzeVoicingOptions(midis)[0] || null;
}

export function negativeHarmonyLabel(midis) {
  const recognized = negativeHarmonyAnalysis(midis);
  if (!recognized) return "Negative harmony";
  return CONVENTIONAL_ROOT_NAMES[recognized.rootPc] + recognized.suffix +
    (recognized.rootless ? " (rootless)" : "");
}

export function negativeHarmonyUsesFlats(midis) {
  const recognized = negativeHarmonyAnalysis(midis);
  return recognized ? FLAT_ROOTS.has(recognized.rootPc) : false;
}
