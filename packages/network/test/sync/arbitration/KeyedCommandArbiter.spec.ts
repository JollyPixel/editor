// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  KeyedCommandArbiter,
  type NetworkCommandHeader
} from "#src/index.ts";

type BoardCommand = NetworkCommandHeader & (
  | { action: "set"; keys: string[]; }
  | { action: "paint"; keys: string[]; }
  | { action: "clear"; scope: string; }
  | { action: "note"; scope: string; key: string; }
);

interface Board {
  locked: Set<string>;
}

function command(
  overrides: Partial<BoardCommand> = {}
): BoardCommand {
  return {
    clientId: "A",
    seq: 1,
    timestamp: 1000,
    action: "set",
    keys: ["k"],
    ...overrides
  } as BoardCommand;
}

function note(
  overrides: Partial<BoardCommand> = {}
): BoardCommand {
  return command({
    action: "note",
    scope: "notes",
    key: "n",
    ...overrides
  } as Partial<BoardCommand>);
}

function arbiter() {
  return new KeyedCommandArbiter<BoardCommand, Board>({
    accepts: (board, cmd) => !("keys" in cmd) ||
      cmd.keys.every((key) => !board.locked.has(key)),
    writes: (cmd) => {
      switch (cmd.action) {
        case "clear":
          return { scope: cmd.scope, reset: true };
        case "note":
          return { scope: cmd.scope, keys: [cmd.key] };
        default:
          return { keys: cmd.keys };
      }
    },
    narrow: (cmd, keep) => (cmd.action === "paint" ?
      { ...cmd, keys: keep.map((index) => cmd.keys[index]) } :
      null)
  });
}

function board(
  ...locked: string[]
): Board {
  return {
    locked: new Set(locked)
  };
}

describe("KeyedCommandArbiter", () => {
  test("refuses a command the state does not accept, without claiming its keys", () => {
    const conflicts = arbiter();

    assert.equal(conflicts.admit(board("k"), command({ timestamp: 900 })), null);
    assert.notEqual(
      conflicts.admit(board(), command({ clientId: "B", timestamp: 100 })),
      null
    );
  });

  test("protects a committed write from an older peer write at the same key", () => {
    const conflicts = arbiter();
    conflicts.admit(board(), command({ timestamp: 900 }))!.commit();

    assert.equal(conflicts.admit(board(), command({ clientId: "B", timestamp: 500 })), null);
    assert.notEqual(
      conflicts.admit(board(), command({ clientId: "B", timestamp: 500, keys: ["j"] })),
      null
    );
  });

  test("admits a command that writes no keys", () => {
    const conflicts = arbiter();
    conflicts.admit(board(), command({ timestamp: 900 }))!.commit();

    assert.notEqual(conflicts.admit(board(), command({ clientId: "B", timestamp: 100, keys: [] })), null);
  });

  test("refuses the whole command when one key loses and the command cannot narrow", () => {
    const conflicts = arbiter();
    conflicts.admit(board(), command({ timestamp: 900, keys: ["b"] }))!.commit();

    assert.equal(
      conflicts.admit(board(), command({ clientId: "B", timestamp: 500, keys: ["a", "b"] })),
      null
    );
  });

  test("narrows a command to the keys it wins and records only those", () => {
    const conflicts = arbiter();
    conflicts.admit(board(), command({ timestamp: 900, keys: ["b"] }))!.commit();

    const admission = conflicts.admit(
      board(),
      command({ action: "paint", clientId: "B", timestamp: 500, keys: ["a", "b", "c"] })
    );
    assert.deepEqual(admission?.command, command({
      action: "paint",
      clientId: "B",
      timestamp: 500,
      keys: ["a", "c"]
    }));
    admission!.commit();

    assert.equal(conflicts.admit(board(), command({ clientId: "C", timestamp: 400, keys: ["a"] })), null);
    assert.equal(conflicts.admit(board(), command({ clientId: "C", timestamp: 700, keys: ["b"] })), null);
  });

  test("refuses a narrowable command that wins none of its keys", () => {
    const conflicts = arbiter();
    conflicts.admit(board(), command({ timestamp: 900, keys: ["a"] }))!.commit();

    assert.equal(
      conflicts.admit(board(), command({ action: "paint", clientId: "B", timestamp: 500, keys: ["a"] })),
      null
    );
  });

  test("a reset floors only the keys of its own scope", () => {
    const conflicts = arbiter();
    conflicts.admit(board(), command({ action: "clear", scope: "notes", timestamp: 900 }))!.commit();

    assert.equal(
      conflicts.admit(board(), note({ clientId: "B", timestamp: 500 })),
      null
    );
    assert.notEqual(
      conflicts.admit(board(), command({ clientId: "B", timestamp: 500 })),
      null
    );
  });

  test("restore records a past command at its version, so replays on an older basis are refused", () => {
    const conflicts = arbiter();
    conflicts.restore(command(), 8);

    assert.equal(conflicts.admit(board(), command({ clientId: "B", basis: 2 })), null);
    assert.notEqual(conflicts.admit(board(), command({ clientId: "B", basis: 8 })), null);
  });

  test("restore replays a reset as its scope's floor", () => {
    const conflicts = arbiter();
    conflicts.restore(command({ action: "clear", scope: "notes" }), 8);

    assert.equal(
      conflicts.admit(board(), note({ clientId: "B", basis: 2 })),
      null
    );
    assert.notEqual(conflicts.admit(board(), command({ clientId: "B", basis: 2 })), null);
  });
});
