// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CommandHistory,
  EMPTY_HISTORY_STATE
} from "#src/index.ts";
import {
  NumbersDocument,
  setup,
  type Scope
} from "../helpers/history/NumbersDocument.ts";

describe("CommandHistory", () => {
  test("a scope without steps reports the empty state", () => {
    const { history, document } = setup();

    assert.deepEqual(history.state("build"), EMPTY_HISTORY_STATE);
    document.set("a", 1);
    assert.notDeepEqual(history.state("build"), EMPTY_HISTORY_STATE);
    assert.ok(Object.isFrozen(EMPTY_HISTORY_STATE));
  });

  test("a scope a registration names starts with its first step", () => {
    const history = new CommandHistory<Scope>();
    const document = new NumbersDocument("numbers");
    history.register(document.registration(() => "paint"));

    assert.deepEqual(history.state("paint"), EMPTY_HISTORY_STATE);
    document.set("a", 1);

    assert.equal(history.state("paint").undoCount, 1);
    assert.equal(history.undo("paint"), true);
    assert.equal(document.values.has("a"), false);
  });

  test("an explicit record starts its scope", () => {
    const history = new CommandHistory<Scope>();
    const document = new NumbersDocument("numbers");
    history.register(document.registration(() => "build"));

    history.record("paint", "Paint", () => document.set("a", 1));

    assert.equal(history.state("paint").undoLabel, "Paint");
    assert.equal(history.state("build").undoCount, 0);
  });

  test("a removed scope drops its steps and reports the empty state", () => {
    const { history, document } = setup();
    history.record("paint", null, () => document.set("a", 1));
    const changes: [Scope, unknown][] = [];
    history.on("change", (scope, state) => changes.push([scope, state]));

    history.removeScope("paint");
    history.removeScope("paint");

    assert.deepEqual(changes, [["paint", EMPTY_HISTORY_STATE]]);
    assert.deepEqual(history.state("paint"), EMPTY_HISTORY_STATE);
    assert.equal(document.values.get("a"), 1);
    assert.equal(history.state("build").undoCount, 0);
  });

  test("a step recorded while its scope is removed files nothing", () => {
    const { history, document } = setup();

    history.record("paint", null, () => {
      document.set("a", 1);
      history.removeScope("paint");
    });

    assert.equal(history.state("paint").undoCount, 0);
  });

  test("a server refusal of a removed scope's step is ignored", () => {
    const { history, document, refused } = setup({ synced: true });
    const change = history.record("paint", null, () => document.set("a", 1)!);

    history.removeScope("paint");
    document.receipts.refuse(change);

    assert.deepEqual(refused, []);
  });

  test("a change its document scopes to null makes no step, yet joins an open record", () => {
    const { history, document, activate } = setup();

    activate(null);
    document.set("a", 1);
    assert.deepEqual([history.state("build").undoCount, history.state("paint").undoCount], [0, 0]);

    history.record("build", "Grouped", () => document.set("b", 2));
    assert.equal(history.state("build").undoLabel, "Grouped");
    assert.equal(history.undo("build"), true);
    assert.deepEqual(Object.fromEntries(document.values), { a: 1 });
  });

  test("an unnamed record takes the label of its first change", () => {
    const { history, document } = setup();

    history.record("build", null, () => {
      document.set("a", 1);
      document.set("b", 2);
    });

    assert.deepEqual([history.state("build").undoLabel, history.state("build").undoCount], ["Set a", 1]);
  });

  test("files each local change in its document's scope, and record groups changes into one step", () => {
    const { history, document, activate } = setup();

    document.set("a", 1);
    activate("paint");
    document.set("b", 1);
    history.record("build", "Both", () => {
      document.set("a", 2);
      history.record("paint", "Inner", () => document.set("c", 3));
    });

    assert.deepEqual(
      [history.state("build").undoLabel, history.state("build").undoCount, history.state("paint").undoCount],
      ["Both", 2, 1]
    );
    assert.equal(history.undo("build"), true);
    assert.deepEqual(Object.fromEntries(document.values), { a: 1, b: 1 });
    assert.equal(history.undo("paint"), true);
    assert.deepEqual(Object.fromEntries(document.values), { a: 1 });
  });

  test("undoes and redoes across documents as one step, and a new step drops the redo", () => {
    const { history, document } = setup();
    const other = new NumbersDocument("other");
    history.register(other.registration(() => "build"));

    history.record("build", "Both", () => {
      document.set("a", 1);
      other.set("x", 9);
    });
    history.undo("build");
    assert.deepEqual([document.values.size, other.values.size], [0, 0]);

    history.redo("build");
    assert.deepEqual([document.values.get("a"), other.values.get("x")], [1, 9]);

    history.undo("build");
    document.set("b", 2);
    assert.equal(history.state("build").canRedo, false);
  });

  test("an edit without an inverse files no step", () => {
    const { history, document } = setup();

    document.set("cursor", 1);
    history.record("build", "Move cursor", () => document.set("cursor", 2));

    assert.equal(history.state("build").canUndo, false);
  });

  test("undo and redo do nothing while a record runs", () => {
    const { history, document } = setup();
    document.set("a", 1);

    const stepped = history.record("build", null, () => [history.undo("build"), history.redo("build")]);

    assert.deepEqual(stepped, [false, false]);
    assert.equal(document.values.get("a"), 1);
  });

  test("an open step spans calls until commit, and nested steps join it", () => {
    const { history, document } = setup();

    const step = history.open("build", "Drag");
    document.set("a", 1);
    history.open("paint", "Inner").commit();
    document.set("b", 2);
    const undone = history.undo("build");
    step.commit();
    step.commit();

    assert.equal(undone, false);
    assert.equal(history.state("build").undoCount, 1);
    assert.equal(history.state("build").undoLabel, "Drag");
    assert.equal(history.undo("build"), true);
    assert.equal(document.values.has("a"), false);
    assert.equal(document.values.has("b"), false);
  });

  test("a cancelled step files nothing and keeps its changes", () => {
    const { history, document } = setup();

    const step = history.open("build", "Drag");
    document.set("a", 1);
    step.cancel();
    step.commit();

    assert.equal(document.values.get("a"), 1);
    assert.equal(history.state("build").canUndo, false);
  });

  test("a registration's compact rewrites the commands a step files", () => {
    const history = new CommandHistory<Scope>();
    const document = new NumbersDocument("numbers");
    history.register({
      ...document.registration(() => "build"),
      compact: (commands) => [...new Map(commands.map((command) => [command.key, command])).values()]
    });

    history.record("build", "Twice", () => {
      document.set("a", 1);
      document.set("a", 2);
    });
    history.undo("build");
    document.changes.length = 0;
    history.redo("build");

    assert.deepEqual(document.changes.map(({ command }) => command), [{ key: "a", value: 2 }]);
  });

  test("keeps the newest steps up to the limit", () => {
    const { history, document } = setup({ limit: 2 });

    document.set("a", 1);
    document.set("a", 2);
    document.set("a", 3);

    assert.equal(history.undo("build"), true);
    assert.equal(history.undo("build"), true);
    assert.equal(history.undo("build"), false);
    assert.equal(document.values.get("a"), 1);
  });

  test("an undo notifies once, after the step left its stack", () => {
    const { history, document } = setup();
    document.set("a", 1);
    const counts: number[][] = [];
    history.on("change", (_scope, state) => counts.push([state.undoCount, state.redoCount]));

    history.undo("build");

    assert.deepEqual(counts, [[0, 1]]);
  });

  test("throws on a second document under one id", () => {
    const { history, document } = setup();

    assert.throws(
      () => history.register(document.registration(() => "build")),
      { message: "CommandHistory: a document \"numbers\" is already registered." }
    );
  });

  test("a removed scope has nothing to undo or redo until its next step", () => {
    const { history, document } = setup();
    history.record("paint", null, () => document.set("a", 1));
    history.removeScope("paint");

    assert.equal(history.undo("paint"), false);
    assert.equal(history.redo("paint"), false);
    history.record("paint", null, () => document.set("b", 2));
    assert.equal(history.state("paint").undoCount, 1);
  });

  test("rejects a limit that is not a positive integer", () => {
    assert.throws(
      () => new CommandHistory({ limit: 0 }),
      RangeError
    );
  });

  test("dispose releases every document and drops every step", () => {
    const { history, document } = setup();
    document.set("a", 1);

    history.dispose();
    document.set("b", 2);

    assert.equal(history.state("build").undoCount, 0);
    assert.doesNotThrow(() => history.register(document.registration(() => "build")));
  });
});
