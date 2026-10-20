// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  KeyedCommandArbiter,
  type ConflictResolver,
  type NetworkCommandHeader
} from "#src/index.ts";

type SetCommand = NetworkCommandHeader & {
  key: string;
};

interface Board {
  locked: Set<string>;
}

function command(
  overrides: Partial<SetCommand> = {}
): SetCommand {
  return {
    clientId: "A",
    seq: 1,
    timestamp: 1000,
    key: "k",
    ...overrides
  };
}

function arbiter(
  conflictResolver?: ConflictResolver<SetCommand>
) {
  return new KeyedCommandArbiter<SetCommand, Board>({
    accepts: (board, { key }) => !board.locked.has(key),
    keys: ({ key }) => [key],
    conflictResolver
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

  test("protects a committed write from an older peer write at the same key by default", () => {
    const conflicts = arbiter();
    conflicts.admit(board(), command({ timestamp: 900 }))!.commit();

    assert.equal(conflicts.admit(board(), command({ clientId: "B", timestamp: 500 })), null);
    assert.notEqual(
      conflicts.admit(board(), command({ clientId: "B", timestamp: 500, key: "j" })),
      null
    );
  });

  test("restore records a past command at its version, so replays on an older basis are refused", () => {
    const conflicts = arbiter();
    conflicts.restore(command(), 8);

    assert.equal(conflicts.admit(board(), command({ clientId: "B", basis: 2 })), null);
    assert.notEqual(conflicts.admit(board(), command({ clientId: "B", basis: 8 })), null);
  });

  test("resolves conflicts with the given resolver", () => {
    const conflicts = arbiter({
      resolve: () => "reject"
    });

    assert.equal(conflicts.admit(board(), command()), null);
  });
});
