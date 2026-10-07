// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { HistoryStepInfo } from "#src/index.ts";
import {
  NumbersDocument,
  setup
} from "../helpers/history/NumbersDocument.ts";

describe("CommandHistory refusal", () => {
  test("a peer writing a value the step guards refuses it at once; undo passes over it", () => {
    const { history, document, refused } = setup();
    const skipped: HistoryStepInfo[] = [];
    history.on("skipped", (_scope, step) => skipped.push(step));

    document.set("a", 1);
    document.set("b", 1);
    document.peer("b", 5, "alice");
    document.peer("c", 7, "bob");

    assert.deepEqual(refused, [{ label: "Set b", refused: { reason: "peer", clientId: "alice" } }]);
    assert.deepEqual(history.state("build").undoCount, 1);
    assert.equal(history.undo("build"), true);
    assert.deepEqual(skipped.map(({ label }) => label), ["Set b"]);
    assert.deepEqual(Object.fromEntries(document.values), { b: 5, c: 7 });
  });

  test("a peer change inside a container refuses undoing the container's creation", () => {
    const { history, document } = setup();

    document.set("box", 1);
    document.peer("box/a", 2, "alice");

    assert.equal(history.state("build").canUndo, false);
  });

  test("a reload refuses the settled steps whose values it changed", () => {
    const { history, document } = setup();
    document.set("a", 1);
    document.set("b", 2);

    document.load({ a: 1, b: 9 });

    assert.deepEqual(history.state("build").refused, [
      { label: "Set b", refused: { reason: "changed" } }
    ]);
    assert.equal(history.undo("build"), true);
    assert.equal(document.values.has("a"), false);
  });

  test("this person's own unrecorded edit never makes a step stale on reload", () => {
    const { history, document, activate } = setup();

    document.set("a", 1);
    activate(null);
    document.set("a", 2);
    document.load({ a: 2 });

    assert.deepEqual(history.state("build").refused, []);
    assert.equal(history.state("build").canUndo, true);
  });

  test("a document reopened under the same id guards the steps filed before it closed", () => {
    const { history } = setup();
    const closing = new NumbersDocument("set");
    const unregister = history.register(closing.registration(() => "build"));
    closing.set("a", 1);
    unregister();

    const reopened = new NumbersDocument("set");
    reopened.load({ a: 1 });
    history.register(reopened.registration(() => "build"));
    reopened.load({ a: 2 });

    assert.deepEqual(history.state("build").refused, [
      { label: "Set a", refused: { reason: "changed" } }
    ]);
  });

  test("an undo refuses a step whose values changed through a write no change reported", () => {
    const { history, document, refused } = setup();
    document.set("a", 1);
    document.set("b", 2);

    document.values.set("b", 5);

    assert.equal(history.undo("build"), true);
    assert.deepEqual(refused, [{ label: "Set b", refused: { reason: "changed" } }]);
    assert.deepEqual(Object.fromEntries(document.values), { b: 5 });
  });

  test("refuses a step whose document closed, and one every command of which is refused", () => {
    const { history, document } = setup();
    const other = new NumbersDocument("other");
    const unregister = history.register(other.registration(() => "build"));

    document.set("locked", 1);
    other.set("x", 1);
    unregister();
    document.locked.add("locked");

    assert.equal(history.undo("build"), false);
    assert.deepEqual(history.state("build").refused, [
      { label: "Set x", refused: { reason: "closed", documentId: "other" } },
      { label: "Set locked", refused: { reason: "gone" } }
    ]);
  });
});
