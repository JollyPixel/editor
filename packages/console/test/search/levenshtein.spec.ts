// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  distance,
  prefixDistance
} from "#src/search/levenshtein.ts";

function reference(
  left: string,
  right: string
): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row++) {
    const current = [row];
    for (let column = 1; column <= right.length; column++) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost
      );
    }
    previous = current;
  }

  return previous[right.length];
}

function randomWord(
  next: () => number,
  length: number
): string {
  return Array.from({ length }, () => "abcd."[Math.floor(next() * 5)]).join("");
}

function seeded(
  seed: number
): () => number {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
}

describe("distance", () => {
  test("known distances", () => {
    assert.equal(distance("kitten", "sitting"), 3);
    assert.equal(distance("brush.grow", "brush.grwo"), 2);
    assert.equal(distance("help", "help"), 0);
    assert.equal(distance("", "help"), 4);
    assert.equal(distance("help", ""), 4);
    assert.equal(distance("", ""), 0);
  });

  test("is symmetric", () => {
    assert.equal(distance("size", "brush.size"), distance("brush.size", "size"));
  });

  test("matches the dynamic programming result on both sides of 32 characters", () => {
    const next = seeded(7);
    for (let run = 0; run < 300; run++) {
      const left = randomWord(next, Math.floor(next() * 80));
      const right = randomWord(next, Math.floor(next() * 80));

      assert.equal(distance(left, right), reference(left, right), `${left} / ${right}`);
    }
  });
});

describe("prefixDistance", () => {
  test("is the smallest distance to a text window of the allowed lengths", () => {
    assert.equal(prefixDistance("grwo", "brush.grow", 6, 3, 4), 1);
    assert.equal(prefixDistance("brush", "brush.size", 0, 4, 6), 0);
    assert.equal(prefixDistance("", "size", 0, 2, 4), 2);
  });

  test("matches the dynamic programming result on both sides of 32 characters", () => {
    const next = seeded(11);
    for (let run = 0; run < 300; run++) {
      const pattern = randomWord(next, 1 + Math.floor(next() * 40));
      const text = randomWord(next, Math.floor(next() * 50));
      const start = Math.floor(next() * (text.length + 1));
      const longest = Math.floor(next() * (text.length - start + 1));
      const shortest = Math.floor(next() * (longest + 1));

      let expected = Infinity;
      for (let length = shortest; length <= longest; length++) {
        expected = Math.min(expected, reference(pattern, text.slice(start, start + length)));
      }

      assert.equal(
        prefixDistance(pattern, text, start, shortest, longest),
        expected,
        `${pattern} / ${text} [${start}, ${shortest}..${longest}]`
      );
    }
  });
});
