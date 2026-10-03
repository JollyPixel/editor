// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CommandSync,
  type ClientEnvelope,
  type NetworkCommandHeader,
  type NetworkServerMessage
} from "#src/index.ts";
import { RoomHarness } from "../../helpers/client/RoomHarness.ts";

type TestCommand = { action: "set"; value: number; } & NetworkCommandHeader;

interface TestSnapshot {
  value: number;
}

type TestMessage = NetworkServerMessage<TestCommand, TestSnapshot>;

function setup() {
  const harness = new RoomHarness<TestCommand, TestMessage>();
  const sync = new CommandSync<TestCommand, TestSnapshot>(harness.room);
  const applied: number[] = [];
  sync.on("command", (command) => applied.push(command.value));
  harness.room.join();
  harness.admit("A");

  function reconnect(
    self = "B"
  ): void {
    harness.room.suspend();
    harness.room.rejoin();
    harness.admit(self);
  }

  return {
    harness,
    sync,
    applied,
    reconnect
  };
}

function command(
  clientId: string,
  seq: number,
  value = seq
): TestCommand {
  return {
    action: "set",
    value,
    clientId,
    seq,
    timestamp: 0
  };
}

function joins(
  sent: readonly ClientEnvelope[]
): unknown[] {
  return sent.flatMap((envelope) => (
    envelope.kind === "join" ? [envelope.resume] : []
  ));
}

function sentCommands(
  harness: RoomHarness<TestCommand, TestMessage>
): string[] {
  return (harness.messages as TestCommand[]).map(
    (sent) => `${sent.clientId}:${sent.seq}:${sent.value}`
  );
}

describe("CommandSync resume", () => {
  test("rejoins with the previous client id and the last room version", () => {
    const { harness, reconnect } = setup();

    harness.serverMessage({ type: "command", data: command("peer", 1), version: 4 });
    harness.serverMessage({ type: "snapshot", data: { value: 0 }, version: 6 });
    harness.serverMessage({ type: "command", data: command("peer", 2), version: 7 });
    reconnect();

    assert.deepEqual(joins(harness.sent), [
      undefined,
      { clientId: "A", version: 7 }
    ]);
  });

  test("holds commands until the catch-up, then resends what it did not acknowledge", () => {
    const { harness, sync } = setup();

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    harness.room.suspend();
    sync.send({ action: "set", value: 3 });
    harness.room.rejoin();
    harness.admit("B");
    sync.send({ action: "set", value: 4 });
    assert.deepEqual(sentCommands(harness), ["A:1:1", "A:2:2"]);

    harness.serverMessage({
      type: "catch-up",
      data: [command("A", 1)],
      version: 9,
      acks: { A: 1 }
    });

    assert.deepEqual(sentCommands(harness).slice(2), ["B:3:2", "B:4:3", "B:5:4"]);
    assert.strictEqual(sync.pending, 3);
    assert.strictEqual(sync.version, 9);
  });

  test("a command the server processed but rejected before the drop is not resent", () => {
    const { harness, sync, reconnect } = setup();

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    reconnect();
    harness.serverMessage({
      type: "catch-up",
      data: [],
      version: 0,
      acks: { A: 1 }
    });

    assert.deepEqual(sentCommands(harness), ["A:1:1", "A:2:2", "B:3:2"]);
  });

  test("applies the catch-up and ignores the live commands it covers", () => {
    const { harness, sync, applied, reconnect } = setup();

    sync.send({ action: "set", value: 1 });
    reconnect();
    harness.serverMessage({ type: "command", data: command("peer", 1, 50), version: 3 });
    harness.serverMessage({
      type: "catch-up",
      data: [command("peer", 1, 50), command("A", 1)],
      version: 3
    });

    assert.deepEqual(applied, [50]);
    assert.strictEqual(sync.pending, 0);
  });

  test("a snapshot can answer the resume", () => {
    const { harness, sync, applied, reconnect } = setup();

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    reconnect();
    harness.serverMessage({ type: "snapshot", data: { value: 0 }, version: 12, acks: { A: 1 } });

    assert.deepEqual(applied, [2]);
    assert.deepEqual(sentCommands(harness).at(-1), "B:3:2");
    assert.strictEqual(sync.version, 12);
  });

  test("an own echo from the previous connection acknowledges during the resume", () => {
    const { harness, sync, reconnect } = setup();

    sync.send({ action: "set", value: 1 });
    reconnect();
    harness.serverMessage({ type: "command", data: command("A", 1) });

    assert.strictEqual(sync.pending, 0);
  });

  test("stops holding past the bound, then drops the ledger and rejoins without resume", () => {
    const { harness, sync, reconnect } = setup();
    let overflows = 0;
    sync.on("overflow", () => overflows++);

    harness.room.suspend();
    for (let value = 0; value < 600; value++) {
      sync.send({ action: "set", value });
    }
    assert.strictEqual(overflows, 1);
    assert.strictEqual(sync.overflowed, true);
    assert.strictEqual(sync.pending, 501);

    reconnect();

    assert.deepEqual(joins(harness.sent).at(-1), undefined);
    assert.strictEqual(sync.pending, 0);
    assert.strictEqual(sync.overflowed, false);
    assert.deepEqual(sentCommands(harness), []);
  });
});
