// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveDropIndex,
  type DropCandidate
} from "../../src/interaction/dropIndex.ts";

// CONSTANTS
const kStack: DropCandidate[] = [
  { start: 0, size: 100 },
  { start: 100, size: 100 },
  { start: 200, size: 100 }
];

describe("Interaction.resolveDropIndex", () => {
  test("returns zero above the first midpoint", () => {
    assert.equal(
      resolveDropIndex({ position: 10, candidates: kStack }),
      0
    );
    assert.equal(
      resolveDropIndex({ position: 49, candidates: kStack }),
      0
    );
  });

  test("counts every midpoint the pointer has passed", () => {
    assert.equal(
      resolveDropIndex({ position: 51, candidates: kStack }),
      1
    );
    assert.equal(
      resolveDropIndex({ position: 151, candidates: kStack }),
      2
    );
    assert.equal(
      resolveDropIndex({ position: 251, candidates: kStack }),
      3
    );
  });

  test("never exceeds the candidate count", () => {
    assert.equal(
      resolveDropIndex({ position: 10_000, candidates: kStack }),
      kStack.length
    );
  });

  test("resolves to zero for an empty container", () => {
    assert.equal(
      resolveDropIndex({ position: 240, candidates: [] }),
      0
    );
  });

  test("holds the current index inside the dead band", () => {
    // Past the first midpoint, but not by the six pixels required to leave.
    assert.equal(
      resolveDropIndex({
        position: 53,
        candidates: kStack,
        current: 0
      }),
      0
    );
    assert.equal(
      resolveDropIndex({
        position: 47,
        candidates: kStack,
        current: 1
      }),
      1
    );
  });

  test("leaves the current index once the dead band is cleared", () => {
    assert.equal(
      resolveDropIndex({
        position: 57,
        candidates: kStack,
        current: 0
      }),
      1
    );
    assert.equal(
      resolveDropIndex({
        position: 43,
        candidates: kStack,
        current: 1
      }),
      0
    );
  });

  test("does not oscillate while a hand jitters on a boundary", () => {
    let index = 0;
    for (const position of [51, 49, 52, 48, 53, 47]) {
      index = resolveDropIndex({
        position,
        candidates: kStack,
        current: index
      });
    }

    assert.equal(index, 0);
  });

  test("honours a custom dead band", () => {
    assert.equal(
      resolveDropIndex({
        position: 60,
        candidates: kStack,
        current: 0,
        deadBand: 20
      }),
      0
    );
    assert.equal(
      resolveDropIndex({
        position: 60,
        candidates: kStack,
        current: 0,
        deadBand: 0
      }),
      1
    );
  });

  test("crosses several boundaries at once on a fast move", () => {
    assert.equal(
      resolveDropIndex({
        position: 260,
        candidates: kStack,
        current: 0
      }),
      3
    );
  });

  test("ignores a current index the candidate list no longer has", () => {
    assert.equal(
      resolveDropIndex({
        position: 51,
        candidates: kStack,
        current: 9
      }),
      1
    );
    assert.equal(
      resolveDropIndex({
        position: 51,
        candidates: kStack,
        current: -1
      }),
      1
    );
  });

  test("treats a null current index as unbiased", () => {
    assert.equal(
      resolveDropIndex({
        position: 51,
        candidates: kStack,
        current: null
      }),
      1
    );
  });

  test("works on variable-height candidates", () => {
    const uneven: DropCandidate[] = [
      { start: 0, size: 20 },
      { start: 20, size: 200 }
    ];

    assert.equal(
      resolveDropIndex({ position: 15, candidates: uneven }),
      1
    );
    assert.equal(
      resolveDropIndex({ position: 119, candidates: uneven }),
      1
    );
    assert.equal(
      resolveDropIndex({ position: 121, candidates: uneven }),
      2
    );
  });
});
