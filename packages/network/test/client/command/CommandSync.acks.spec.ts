// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createCommandSync,
  remote,
  type TestCommand
} from "../../helpers/client/commandSync.ts";

describe("CommandSync — acknowledgements", () => {
  test("a snapshot replays the pending commands its acks do not cover", () => {
    const { harness, sync } = createCommandSync();
    const values: number[] = [];
    sync.on("command", (command) => values.push(command.value));

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    sync.send({ action: "set", value: 3 });
    harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 1 } });
    harness.serverMessage({ type: "snapshot", data: { value: 1 }, acks: { self: 2 } });
    harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 3 } });

    assert.deepEqual(values, [3]);
    assert.strictEqual(sync.pending, 0);
  });

  test("a correction acknowledges the corrected command and replays the later ones", () => {
    const { harness, sync } = createCommandSync();
    const received: TestCommand[] = [];
    sync.on("command", (command) => received.push(command));

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    const correction = { ...remote("self"), value: 0, seq: 1 };
    harness.serverMessage({ type: "correction", data: correction, acks: { self: 1 } });

    assert.deepEqual(received.map((command) => command.value), [0, 2]);
    assert.strictEqual(received[0], correction);
    assert.strictEqual(sync.pending, 1);
  });

  test("a correction without acks still acknowledges its own seq", () => {
    const { harness, sync } = createCommandSync();

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    harness.serverMessage({
      type: "correction",
      data: { ...remote("self"), value: 0, seq: 1 }
    });

    assert.strictEqual(sync.pending, 1);
  });

  test("tells which own command the server refused, only when the snapshot or correction names it", () => {
    const { harness, sync } = createCommandSync();
    const refused: number[] = [];
    sync.on("refused", (command) => refused.push(command.value));

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    sync.send({ action: "set", value: 3 });
    harness.serverMessage({ type: "snapshot", data: { value: 0 }, acks: { self: 1 } });
    harness.serverMessage({ type: "snapshot", data: { value: 0 }, acks: { self: 2 }, refused: 2 });
    harness.serverMessage({
      type: "correction",
      data: { ...remote("self"), value: 0, seq: 3 },
      refused: 3
    });

    assert.deepEqual(refused, [2, 3]);
    assert.strictEqual(sync.pending, 0);
  });

  test("reports each acknowledged command once, with the version of the message that acknowledged it", () => {
    const { harness, sync } = createCommandSync();
    const outcomes: string[] = [];
    sync.on("acknowledged", (command, version) => outcomes.push(`${command.value}@${version}`));
    sync.on("refused", (command) => outcomes.push(`${command.value} refused`));

    for (let value = 1; value <= 4; value++) {
      sync.send({ action: "set", value });
    }
    harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 1 }, version: 3 });
    harness.serverMessage({
      type: "snapshot",
      data: { value: 0 },
      version: 5,
      acks: { self: 3 },
      refused: 3
    });
    harness.serverMessage({ type: "correction", data: remote("peer"), acks: { self: 4 } });

    assert.deepEqual(outcomes, ["1@3", "2@5", "3 refused", "4@undefined"]);
  });

  test("a snapshot received before admission replays the held commands", () => {
    const { harness, sync } = createCommandSync({ admitted: false });
    const values: number[] = [];
    sync.on("command", (command) => values.push(command.value));

    sync.send({ action: "set", value: 1 });
    harness.admit("A");
    harness.serverMessage({ type: "snapshot", data: { value: 0 } });
    harness.serverMessage({ type: "command", data: { ...remote("A"), seq: 1 } });

    assert.deepEqual(values, [1]);
    assert.strictEqual(sync.pending, 0);
  });

  test("an own echo acknowledges every command up to its seq, at its version", () => {
    const { harness, sync } = createCommandSync();
    const acknowledged: string[] = [];
    sync.on("acknowledged", (command, version) => acknowledged.push(`${command.value}@${version}`));

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    sync.send({ action: "set", value: 3 });
    assert.strictEqual(sync.pending, 3);

    harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 2 }, version: 9 });

    assert.deepEqual(acknowledged, ["1@9", "2@9"]);
    assert.strictEqual(sync.pending, 1);
  });

  test("emits settled when the last pending command is acknowledged", () => {
    const { harness, sync } = createCommandSync();
    let settled = 0;
    sync.on("settled", () => settled++);

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 1 } });
    assert.strictEqual(settled, 0);
    harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 2 } });
    harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 2 } });

    assert.strictEqual(settled, 1);
  });
});
