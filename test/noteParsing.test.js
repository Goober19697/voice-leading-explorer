import test from "node:test";
import assert from "node:assert/strict";

import { parseVoicing } from "../src/noteParsing.js";

function analyze(text) {
  return { currentVoicing: parseVoicing(text).midis };
}

test("default middle voicing preserves entry order with nearest ascending octaves", () => {
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
