// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ScriptCompletion } from "@jolly-pixel/scripting/language";

// Import Internal Dependencies
import { CompletionList } from "#src/panes/code/CompletionList.ts";

// CONSTANTS
const kText = "this.actor.addCo;";
const kWordStart = kText.indexOf("addCo");

function completion(
  name: string
): ScriptCompletion {
  return {
    name,
    kind: "method",
    insertText: name,
    start: kWordStart,
    length: "addCo".length
  };
}

function completionList(
  names: string[]
): CompletionList {
  const list = CompletionList.from(kText, names.map(completion));
  assert.ok(list !== null);

  return list;
}

describe("CompletionList", () => {
  test("no completion makes no list", () => {
    assert.equal(CompletionList.from(kText, []), null);
  });

  test("accepting replaces the typed word and leaves the caret after the inserted name", () => {
    const accepted = completionList(["addComponent", "addComponentAndGet"]).move(1).accept();

    assert.equal(accepted.edit.applyTo(kText), "this.actor.addComponentAndGet;");
    assert.equal(accepted.caret, kWordStart + "addComponentAndGet".length);
  });

  test("moving past either end wraps around", () => {
    const list = completionList(["a", "b", "c"]);

    assert.equal(list.move(-1).chosen.name, "c");
    assert.equal(list.move(3).chosen.name, "a");
  });

  test("the visible window keeps the selection in view without running past the list", () => {
    const list = completionList(Array.from({ length: 30 }, (_, index) => `n${index}`));

    assert.equal(list.window(10).first, 0);
    assert.equal(list.move(15).window(10).first, 10);
    assert.equal(list.move(29).window(10).first, 20);
    assert.equal(list.move(29).window(10).items.length, 10);
  });
});
