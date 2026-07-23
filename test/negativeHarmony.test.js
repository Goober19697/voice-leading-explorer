import test from "node:test";
import assert from "node:assert/strict";

import {
  negativeHarmony,
  negativeHarmonyLabel,
  negativeHarmonyUsesFlats,
} from "../src/negativeHarmony.js";
import { chordLabel } from "../src/chordPatterns.js";

test("negative harmony reflects intervals around the first note", () => {
  assert.deepEqual(negativeHarmony([57, 60, 64]), [50, 54, 57]);
});

test("the pivot remains present while the shadow is ordered from its new root", () => {
  assert.deepEqual(negativeHarmony([60, 64, 67, 72]), [48, 53, 56, 60]);
});

test("the reflected voicing is named from its new root", () => {
  assert.equal(chordLabel(negativeHarmony([57, 60, 64])), "D");
});

test("an inverted shadow is named from its harmonic root with conventional spelling", () => {
  const shadow = negativeHarmony([46, 50, 53, 58]);
  assert.deepEqual(shadow, [34, 39, 42, 46]);
  assert.equal(negativeHarmonyLabel(shadow), "E♭m");
  assert.equal(negativeHarmonyUsesFlats(shadow), true);
});

test("a shadow can be named as a supported chord with an unplayed root", () => {
  assert.equal(negativeHarmonyLabel([47, 49, 56]), "Amaj9 (rootless)");
});

test("an unrecognized shadow still displays intervals from its lowest note", () => {
  assert.equal(negativeHarmonyLabel([60, 61, 62]), "C(♭9,9)");
});

test("an empty voicing has no negative harmony", () => {
  assert.deepEqual(negativeHarmony([]), []);
});
