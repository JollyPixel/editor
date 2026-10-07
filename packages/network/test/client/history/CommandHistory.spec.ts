// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CommandDocument,
  CommandHistory,
  type CommandChange,
  type HistoryRegistration,
  type HistoryStepInfo
} from "#src/client/index.ts";

type Scope = "build" | "paint";

interface SetCommand {
  key: string;
  value: number | undefined;
}

type SetChange = CommandChange<SetCommand, number | undefined>;

class NumbersDocument extends CommandDocument<SetCommand, Record<string, number>, number | undefined> {
  readonly id: string;
  readonly values: Map<string, number>;
  readonly locked: Set<string>;
  readonly bases: (number | undefined)[] = [];
  readonly changes: SetChange[] = [];

  constructor(
    id: string,
    options: { synced?: boolean; } = {}
  ) {
    const values = new Map<string, number>();
    const locked = new Set<string>();
    super({
      accepts: ({ key }) => !locked.has(key),
      placeable: (command) => command,
      apply: ({ key, value }) => {
        if (value === undefined) {
          values.delete(key);
        }
        else {
          values.set(key, value);
        }
      },
      load: (snapshot) => {
        values.clear();
        for (const [key, value] of Object.entries(snapshot)) {
          values.set(key, value);
        }
      },
      imageOf: ({ key }) => values.get(key),
      inverseOf: ({ key }) => [{ key, value: values.get(key) }],
      restored: () => Object.fromEntries(values)
    });
    this.id = id;
    this.values = values;
    this.locked = locked;
    if (options.synced === true) {
      this.receipts.attach();
    }
    this.subscribe("change", (change) => this.changes.push(change));
  }

  set(
    key: string,
    value: number | undefined
  ): SetChange | null {
    return this.commit({ key, value }) ? this.changes.at(-1)! : null;
  }

  peer(
    key: string,
    value: number,
    clientId: string
  ): void {
    this.apply({ key, value }, clientId);
  }

  echo(
    key: string,
    value: number
  ): void {
    this.replayPending({ key, value });
  }

  override applyStep(
    command: SetCommand,
    basis: number | undefined
  ): SetChange | null {
    this.bases.push(basis);

    return super.applyStep(command, basis);
  }

  registration(
    scopeOf: () => Scope | null
  ): HistoryRegistration<Scope, SetCommand, number | undefined> {
    return {
      id: this.id,
      document: this,
      keys: {
        written: ({ command }) => [command.key, ...containersOf(command.key)],
        guards: (commands) => commands.map(({ key }) => {
          return { key, read: () => this.values.get(key) };
        })
      },
      scopeOf,
      label: ({ command }) => `Set ${command.key}`
    };
  }
}

function containersOf(
  key: string
): string[] {
  const parts = key.split("/");

  return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join("/"));
}

function setup(
  options: { synced?: boolean; limit?: number; } = {}
) {
  let active: Scope | null = "build";
  const history = new CommandHistory({
    scopes: ["build", "paint"],
    ...options.limit === undefined ? {} : { limit: options.limit }
  });
  const document = new NumbersDocument("numbers", options);
  history.register(document.registration(() => active));
  const refused: HistoryStepInfo[] = [];
  history.on("refused", (_scope, step) => refused.push(step));

  return {
    history,
    document,
    refused,
    activate: (scope: Scope | null) => {
      active = scope;
    }
  };
}

describe("CommandHistory", () => {
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

  test("this person's own unrecorded edit never makes a step stale on reload", () => {
    const { history, document, activate } = setup();

    document.set("a", 1);
    activate(null);
    document.set("a", 2);
    document.load({ a: 2 });

    assert.deepEqual(history.state("build").refused, []);
    assert.equal(history.state("build").canUndo, true);
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

  test("rejects a limit that is not a positive integer", () => {
    assert.throws(
      () => new CommandHistory({ scopes: ["build"], limit: 0 }),
      RangeError
    );
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

  test("a reload refuses the settled steps whose values it changed", () => {
    const { history, document } = setup();
    document.set("a", 1);
    document.set("b", 2);

    document.load({ a: 1, b: 9 });

    assert.deepEqual(history.state("build").refused, [
      { label: "Set b", refused: { reason: "peer", clientId: null } }
    ]);
    assert.equal(history.undo("build"), true);
    assert.equal(document.values.has("a"), false);
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
      { label: "Set a", refused: { reason: "peer", clientId: null } }
    ]);
  });
});
