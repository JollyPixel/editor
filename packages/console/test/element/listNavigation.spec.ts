// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  initialHighlight,
  moveHighlight,
  type NavigableList
} from "#src/element/listNavigation.ts";

function results(
  count: number
): NavigableList {
  return {
    items: Array.from({ length: count }),
    preselect: true
  };
}

function completions(
  count: number
): NavigableList {
  return {
    items: Array.from({ length: count }),
    preselect: false
  };
}

describe("initialHighlight", () => {
  test("a preselected list highlights its first item, others nothing", () => {
    assert.equal(initialHighlight(results(3)), 0);
    assert.equal(initialHighlight(results(0)), -1);
    assert.equal(initialHighlight(completions(3)), -1);
  });
});

describe("moveHighlight", () => {
  test("a preselected list wraps around", () => {
    assert.equal(moveHighlight(2, 1, results(3)), 0);
    assert.equal(moveHighlight(0, -1, results(3)), 2);
    assert.equal(moveHighlight(0, 1, results(3)), 1);
    assert.equal(moveHighlight(-1, 1, results(3)), 0);
    assert.equal(moveHighlight(-1, -1, results(3)), 2);
  });

  test("completions clamp at the end and go back to the input above the first", () => {
    assert.equal(moveHighlight(-1, 1, completions(2)), 0);
    assert.equal(moveHighlight(1, 1, completions(2)), 1);
    assert.equal(moveHighlight(0, -1, completions(2)), -1);
    assert.equal(moveHighlight(-1, -1, completions(2)), -1);
  });

  test("an empty list highlights nothing", () => {
    assert.equal(moveHighlight(0, 1, results(0)), -1);
    assert.equal(moveHighlight(0, 1, completions(0)), -1);
  });
});
