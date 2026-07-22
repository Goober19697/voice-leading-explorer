import test from "node:test";
import assert from "node:assert/strict";

import {
  candidateAt,
  candidatesForEmotion,
  compareCandidates,
  distinctCandidates,
  nextCandidateIndex,
  previousCandidateIndex,
} from "../src/candidatePool.js";

const candidates = [
  { key: "60,64,67", category: "warm", totalCost: 2, commonCount: 2 },
  { key: "59,62,67", category: "warm", totalCost: 3, commonCount: 1 },
  { key: "58,62,65", category: "sad", totalCost: 4, commonCount: 0 },
];

test("the initial selected candidate is index zero", () => {
  assert.equal(candidateAt(candidates, 0), candidates[0]);
});

test("next advances through candidates in order and stops at the end", () => {
  let index = 0;
  index = nextCandidateIndex(index, candidates.length);
  assert.equal(index, 1);
  index = nextCandidateIndex(index, candidates.length);
  assert.equal(index, 2);
  index = nextCandidateIndex(index, candidates.length);
  assert.equal(index, 2);
});

test("a single candidate cannot advance", () => {
  assert.equal(nextCandidateIndex(0, 1), 0);
});

test("back returns to the prior candidate and stops at the beginning", () => {
  assert.equal(previousCandidateIndex(2), 1);
  assert.equal(previousCandidateIndex(1), 0);
  assert.equal(previousCandidateIndex(0), 0);
});

test("candidate pools remove duplicate physical voicings", () => {
  const duplicate = { ...candidates[0] };
  assert.deepEqual(distinctCandidates([...candidates, duplicate]), candidates);
});

test("emotion selection retains only that category when matches exist", () => {
  assert.deepEqual(candidatesForEmotion(candidates, "warm"), candidates.slice(0, 2));
});

test("an empty emotional category falls back without changing its identity", () => {
  assert.deepEqual(candidatesForEmotion(candidates, "dreamy"), candidates);
});

test("voice-leading distance remains the primary ordering key", () => {
  const close = { key: "close", totalCost: 2, commonCount: 0 };
  const distant = { key: "distant", totalCost: 20, commonCount: 99 };
  assert.ok(compareCandidates(close, distant) < 0);
});

test("a candidate on a new root is offered before a same-root alternative", () => {
  const sameRoot = { key: "same", totalCost: 1, commonCount: 4, rootChanged: false };
  const newRoot = { key: "new", totalCost: 4, commonCount: 2, rootChanged: true };
  assert.ok(compareCandidates(newRoot, sameRoot) < 0);
});
