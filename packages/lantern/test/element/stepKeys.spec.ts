// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  stepKeyAction,
  type StepKeyInput
} from "#src/element/stepKeys.ts";

function key(
  name: string,
  modifiers: Partial<StepKeyInput> = {}
): StepKeyInput {
  return {
    key: name,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...modifiers
  };
}

describe("stepKeyAction", () => {
  const cases: Array<[StepKeyInput, ReturnType<typeof stepKeyAction>]> = [
    [key("ArrowRight"), "next"],
    [key("Enter"), "next"],
    [key("ArrowLeft"), "back"],
    [key("Escape"), "skip"],
    [key("ArrowRight", { ctrlKey: true }), null],
    [key("k", { metaKey: true }), null],
    [key("a"), null]
  ];
  for (const [input, expected] of cases) {
    const modifier = input.ctrlKey || input.metaKey ? "with a modifier " : "";
    test(`maps ${input.key} ${modifier}to ${expected}`, () => {
      assert.equal(stepKeyAction(input), expected);
    });
  }
});
