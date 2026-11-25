// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createCommandSync,
  remote
} from "../../helpers/client/commandSync.ts";

function joinedSync() {
  const joined = createCommandSync({ admitted: false });
  joined.harness.room.join();
  joined.harness.admit();

  return joined;
}

function resyncs(
  sent: readonly { kind: string; }[]
): number {
  return sent.filter((envelope) => envelope.kind === "resync").length;
}

describe("CommandSync — commands the room refuses", () => {
  for (const kind of ["denied", "error"] as const) {
    test(`a ${kind} command is refused after the snapshot, never replayed or acknowledged`, () => {
      const { harness, sync, replayed } = joinedSync();
      const outcomes: string[] = [];
      sync.on("acknowledged", (command) => outcomes.push(`${command.value} acknowledged`));
      sync.on("refused", (command) => outcomes.push(`${command.value} refused`));

      for (let value = 1; value <= 4; value++) {
        sync.send({ action: "set", value });
      }
      harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 1 } });
      harness.deny("set", 2, kind);
      harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 3 } });

      assert.deepEqual(outcomes, ["1 acknowledged", "3 acknowledged"]);
      assert.strictEqual(resyncs(harness.sent), 1);

      harness.serverMessage({ type: "snapshot", data: { value: 3 }, acks: { self: 3 } });

      assert.deepEqual(outcomes, ["1 acknowledged", "3 acknowledged", "2 refused"]);
      assert.deepEqual(replayed.map((command) => command.value), [4]);
      assert.strictEqual(sync.pending, 1);
    });
  }

  test("several refusals during one stroke ask for a single resync", () => {
    const { harness, sync } = joinedSync();
    const refused: number[] = [];
    sync.on("refused", (command) => refused.push(command.value));

    for (let value = 1; value <= 3; value++) {
      sync.send({ action: "set", value });
      harness.deny("set", value);
    }
    harness.serverMessage({ type: "snapshot", data: { value: 0 } });

    assert.strictEqual(resyncs(harness.sent), 1);
    assert.deepEqual(refused, [1, 2, 3]);
    assert.strictEqual(sync.pending, 0);
  });

  test("a refusal naming no pending command of this client leaves the ledger alone", () => {
    const { harness, sync } = joinedSync();

    sync.send({ action: "set", value: 1 });
    harness.deny("$presence");
    harness.deny("set", 7);

    assert.strictEqual(sync.pending, 1);
    assert.strictEqual(resyncs(harness.sent), 0);
  });
});
