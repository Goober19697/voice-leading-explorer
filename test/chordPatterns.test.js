import test from "node:test";
import assert from "node:assert/strict";

import { chordLabel, chordLabels, CHORD_PATTERNS, QUALITIES } from "../src/chordPatterns.js";
import { parseVoicing } from "../src/noteParsing.js";

function label(notes) {
  return chordLabel(parseVoicing(notes).midis);
}

test("all compact altered-dominant formulas are recognized", () => {
  const examples = [
    ["A C# F G", "A7#5"],
    ["A C# Eb G", "A7b5"],
    ["A C# E G C", "A7#9"],
    ["A C# E G Bb", "A7b9"],
    ["A C# F G C", "A7#5#9"],
    ["A C# F G Bb", "A7#5b9"],
    ["A C# Eb G C", "A7b5#9"],
    ["A C# Eb G Bb", "A7b5b9"],
  ];

  for (const [notes, expected] of examples) {
    assert.equal(label(notes), expected, notes);
  }

  assert.notEqual(label("C# F G C"), "A7#5#9 (rootless)");
});

test("altered-dominant recognition ignores input order and octave", () => {
  assert.equal(label("A3 C#4 F4 G4 C5"), "A7#5#9");
  assert.equal(label("C5 A3 G4 F4 C#4"), "A7#5#9");
  assert.equal(label("A C# F G C"), "A7#5#9");
});

test("candidate generation and direct recognition share the chord registry", () => {
  assert.deepEqual(
    QUALITIES,
    CHORD_PATTERNS.map(({ suffix, intervals }) => [suffix, intervals])
  );
  assert.ok(QUALITIES.some(([suffix]) => suffix === "7#5#9"));
});

test("minor-major-seven formulas are not reinterpreted as altered dominants", () => {
  assert.equal(label("A C Eb G#"), "Am(maj7)b5");
  assert.equal(label("A C E G#"), "Am(maj7)");
  assert.equal(label("A C Eb G"), "Am7b5");
});

test("ordinary chord families retain their identities", () => {
  const examples = [
    ["A C# E", "A"],
    ["A C E", "Am"],
    ["A C# F", "Aaug"],
    ["A C Eb", "Adim"],
    ["A C# E G", "A7"],
    ["A C# E G#", "Amaj7"],
    ["A C E G", "Am7"],
    ["A C Eb G", "Am7b5"],
    ["A C Eb Gb", "Adim7"],
    ["A C E G#", "Am(maj7)"],
  ];

  for (const [notes, expected] of examples) {
    assert.equal(label(notes), expected, notes);
  }
});

test("extended eleventh and thirteenth voicings are recognized", () => {
  const examples = [
    ["C Eb G Bb D F", "Cm11"],
    ["C E G B D A", "Cmaj13"],
    ["C E G Bb D A", "C13"],
    ["C Eb Bb D F", "Cm11"],
    ["C E B D A", "Cmaj13"],
    ["C E Bb D A", "C13"],
  ];

  for (const [notes, expected] of examples) {
    assert.equal(label(notes), expected, notes);
  }

  assert.ok(QUALITIES.some(([suffix]) => suffix === "m11"));
  assert.ok(QUALITIES.some(([suffix]) => suffix === "maj13"));
  assert.ok(QUALITIES.some(([suffix]) => suffix === "13"));
});

test("the first entered note determines the primary name and other roots remain optional", () => {
  assert.deepEqual(chordLabels(parseVoicing("C E G A").midis), ["C6", "Am7"]);
  assert.deepEqual(chordLabels(parseVoicing("A C E G").midis), ["Am7", "C6"]);
  assert.equal(label("C E G A"), "C6");
  assert.equal(label("A C E G"), "Am7");
});

test("a root-first minor-thirteenth voicing may omit the ninth", () => {
  const notes = parseVoicing("B D E F# G# A").midis;
  assert.equal(chordLabel(notes), "Bm13");
  assert.equal(chordLabels(notes)[0], "Bm13");
});
