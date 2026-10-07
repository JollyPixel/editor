// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { setup } from "../helpers/history/NumbersDocument.ts";

describe("CommandHistory receipts", () => {
  test("ignores peer edits ordered before the step, and undoes with the step's version", () => {
    const { history, document } = setup({ synced: true });

    const change = document.set("a", 1)!;
    document.peer("a", 4, "alice");
    document.echo("a", 1);
    document.receipts.confirm(change, 12);

    assert.equal(history.undo("build"), true);
    assert.deepEqual(document.bases, [12]);

    document.receipts.confirm(document.set("a", 1)!, 20);
    document.peer("a", 6, "alice");
    assert.equal(history.state("build").canUndo, false, "after its version, the peer edit counts");
  });

  test("an undo whose edit is not confirmed yet replays with basis 0", () => {
    const { history, document } = setup({ synced: true });

    document.set("a", 1);
    history.undo("build");

    assert.deepEqual(document.bases, [0]);
  });

  test("a confirmation without a version still settles the step", () => {
    const { history, document } = setup({ synced: true });

    document.receipts.confirm(document.set("a", 1)!, undefined);
    document.peer("a", 4, "alice");

    assert.equal(history.state("build").canUndo, false);
  });

  test("an edit the server refuses refuses its step", () => {
    const { history, document } = setup({ synced: true });

    document.receipts.refuse(document.set("a", 1)!);

    assert.deepEqual(history.state("build").refused, [
      { label: "Set a", refused: { reason: "server" } }
    ]);
  });

  test("an undo the server refuses puts the step back refused and drops its redo", () => {
    const { history, document } = setup({ synced: true });
    document.receipts.confirm(document.set("a", 1)!, 3);

    history.undo("build");
    assert.equal(history.state("build").canRedo, true);
    document.receipts.refuse(document.changes.at(-1)!);

    const state = history.state("build");
    assert.deepEqual(
      [state.canUndo, state.canRedo, state.refused],
      [false, false, [{ label: "Set a", refused: { reason: "server" } }]]
    );
  });

  test("a change without an inverse joins no step, so the step waits on no receipt of it", () => {
    const { history, document } = setup({ synced: true });

    const change = history.record("build", "Both", () => {
      document.set("cursor", 1);

      return document.set("a", 1)!;
    });
    document.receipts.confirm(change, 3);
    document.peer("a", 4, "alice");

    assert.deepEqual(history.state("build").refused, [
      { label: "Both", refused: { reason: "peer", clientId: "alice" } }
    ]);
  });

  test("ignores receipts of an edit that filed no step", () => {
    const { history, document, activate } = setup({ synced: true });
    activate(null);

    const change = document.set("a", 1)!;
    document.receipts.confirm(change, 2);
    document.receipts.refuse(change);

    assert.deepEqual([history.state("build").undoCount, history.state("build").refused], [0, []]);
  });

  test("discarded receipts refuse the steps still waiting on them, and restore an undone step", () => {
    const { history, document, activate } = setup({ synced: true });
    document.receipts.confirm(document.set("a", 1)!, 3);
    history.undo("build");
    activate("paint");
    document.set("b", 2);

    document.receipts.discard();

    const build = history.state("build");
    assert.deepEqual(
      [build.canUndo, build.canRedo, build.refused],
      [false, false, [{ label: "Set a", refused: { reason: "dropped" } }]]
    );
    assert.deepEqual(history.state("paint").refused, [
      { label: "Set b", refused: { reason: "dropped" } }
    ]);
  });

  test("a receipt for a change the discard dropped changes nothing", () => {
    const { history, document, refused } = setup({ synced: true });
    const change = document.set("a", 1)!;
    document.receipts.discard();

    document.receipts.refuse(change);
    document.receipts.confirm(change, 5);

    assert.deepEqual(refused, [{ label: "Set a", refused: { reason: "dropped" } }]);
    assert.deepEqual(history.state("build").refused, refused);
  });
});
