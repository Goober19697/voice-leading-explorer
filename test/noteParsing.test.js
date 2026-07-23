import test from "node:test";
import assert from "node:assert/strict";

import {
  inferUseFlats,
  KEY_NAMES,
  keyUsesFlats,
  normalizeVoicingSpelling,
  parseVoicing,
  spellMidiForChord,
} from "../src/noteParsing.js";

function analyze(text) {
  return { currentVoicing: parseVoicing(text).midis };
}

test("default third-range voicing preserves entry order with nearest ascending octaves", () => {
  const examples = [
    ["C E G", [48, 52, 55]],
    ["A C E", [57, 60, 64]],
    ["C G B E", [48, 55, 59, 64]],
    ["A E F G C", [57, 64, 65, 67, 72]],
    ["E G C", [52, 55, 60]],
    ["C G C E", [48, 55, 60, 64]],
  ];

  for (const [input, expected] of examples) {
    assert.deepEqual(analyze(input).currentVoicing, expected, input);
  }
});

test("fully octave-qualified input preserves exact MIDI pitches and order", () => {
  assert.deepEqual(analyze("a3 c4 e4").currentVoicing, [57, 60, 64]);
  assert.deepEqual(analyze("g4 c3 e5").currentVoicing, [67, 48, 76]);
});

test("duplicate notes remain represented", () => {
  assert.deepEqual(parseVoicing("c c c").midis, [48, 48, 48]);
});

test("mixed octave input is rejected", () => {
  const result = parseVoicing("a3 c e4");
  assert.equal(result.mixedOctaves, true);
  assert.deepEqual(result.midis, []);
});

test("spelling follows entered accidentals and otherwise the analyzed root", () => {
  assert.equal(inferUseFlats("Ab C Eb", 8), true);
  assert.equal(inferUseFlats("G# B D#", 8), false);
  assert.equal(inferUseFlats("F A C", 5), true);
  assert.equal(inferUseFlats("C E G", 0), false);
});

test("the twelve supported keys use one conventional spelling per pitch class", () => {
  assert.deepEqual(KEY_NAMES, [
    "C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B",
  ]);
  assert.equal(new Set(KEY_NAMES).size, 12);
  assert.equal(KEY_NAMES.includes("F♯"), false);
  assert.equal(KEY_NAMES.includes("C♯"), false);
  assert.equal(KEY_NAMES.includes("C♭"), false);
  assert.equal(keyUsesFlats(2), false);
  assert.equal(keyUsesFlats(6), true);
});

test("chord tones are spelled intervalically from the selected root", () => {
  assert.equal(spellMidiForChord(54, 6), "G♭3");
  assert.equal(spellMidiForChord(52, 6), "F♭3");
  assert.equal(spellMidiForChord(56, 6), "A♭3");
  assert.equal(spellMidiForChord(61, 6), "D♭4");
  assert.equal(spellMidiForChord(66, 2), "F♯4");
  assert.equal(spellMidiForChord(56, 2, "7b5"), "A♭3");
  assert.equal(spellMidiForChord(56, 2, "7♯11"), "G♯3");
});

test("novice enharmonic input is normalized to the analyzed chord", () => {
  const dMajor = parseVoicing("D Gb A").midis;
  assert.equal(normalizeVoicingSpelling("D Gb A", dMajor, 2, ""), "D F♯ A");

  const dAltered = parseVoicing("D F# Ab C").midis;
  assert.equal(
    normalizeVoicingSpelling("D F# Ab C", dAltered, 2, "7b5"),
    "D F♯ A♭ C"
  );

  const exact = parseVoicing("D3 Gb3 A3").midis;
  assert.equal(normalizeVoicingSpelling("D3 Gb3 A3", exact, 2, ""), "D3 F♯3 A3");
});

test("generated double accidentals remain parseable", () => {
  assert.deepEqual(parseVoicing("G♭3 A𝄫3 D𝄫4 F♭4").midis, [54, 55, 60, 64]);
});
