// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CommandSync,
  type ChangeOutbox,
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

class MemoryOutbox implements ChangeOutbox {
  #kept = new Map<NetworkCommandHeader, TestCommand>();

  restore(): NetworkCommandHeader[] {
    return [...this.#kept.keys()];
  }

  keep(
    command: NetworkCommandHeader
  ): void {
    this.#kept.set(command, structuredClone(command as TestCommand));
  }

  drop(
    command: NetworkCommandHeader
  ): void {
    this.#kept.delete(command);
  }

  reload(): MemoryOutbox {
    const reloaded = new MemoryOutbox();
    for (const command of this.#kept.values()) {
      reloaded.keep(structuredClone(command));
    }

    return reloaded;
  }

  get commands(): string[] {
    return [...this.#kept.values()].map(describeCommand);
  }
}

function describeCommand(
  command: TestCommand
): string {
  return `${command.clientId}:${command.seq}:${command.value}`;
}

function open(
  outbox: MemoryOutbox
) {
  const harness = new RoomHarness<TestCommand, TestMessage>();
  const sync = new CommandSync<TestCommand, TestSnapshot>(harness.room);
  const applied: number[] = [];
  const refused: number[] = [];
  sync.on("command", (command) => {
    if (command.value < 0) {
      throw new Error("unreadable command");
    }
    applied.push(command.value);
  });
  sync.on("refused", (command) => refused.push(command.value));
  sync.keepIn(outbox);
  harness.room.join();

  return {
    harness,
    sync,
    applied,
    refused
  };
}

function sentCommands(
  harness: RoomHarness<TestCommand, TestMessage>
): string[] {
  return (harness.messages as TestCommand[]).map(describeCommand);
}

function echo(
  harness: RoomHarness<TestCommand, TestMessage>,
  index: number,
  version: number
): void {
  harness.serverMessage({
    type: "command",
    data: harness.messages[index] as TestCommand,
    version
  });
}

function joins(
  sent: readonly ClientEnvelope[]
): unknown[] {
  return sent.flatMap((envelope) => (
    envelope.kind === "join" ? [envelope.resume] : []
  ));
}

describe("CommandSync outbox", () => {
  test("keeps each unacknowledged command as it was sent", () => {
    const outbox = new MemoryOutbox();
    const { harness, sync } = open(outbox);
    harness.admit("A");
    harness.serverMessage({ type: "snapshot", data: { value: 0 }, version: 0 });

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    echo(harness, 0, 1);

    assert.deepEqual(outbox.commands, ["A:2:2"]);
  });

  test("a later page resumes from the closed page, so the server's acks skip what it already applied", () => {
    const outbox = new MemoryOutbox();
    const closed = open(outbox);
    closed.harness.admit("A");
    closed.harness.serverMessage({ type: "snapshot", data: { value: 0 }, version: 0 });
    closed.sync.send({ action: "set", value: 1 });
    closed.sync.send({ action: "set", value: 2 });
    echo(closed.harness, 0, 1);
    closed.harness.room.suspend();
    closed.sync.send({ action: "set", value: 3 });
    closed.sync.destroy();

    const later = open(outbox.reload());
    assert.deepEqual(joins(later.harness.sent), [{ clientId: "A" }]);
    later.harness.admit("B");
    later.harness.serverMessage({
      type: "snapshot",
      data: { value: 2 },
      version: 2,
      acks: { A: 2 }
    });

    assert.deepEqual(later.applied, [3]);
    assert.deepEqual(sentCommands(later.harness), ["B:1:3"]);
    assert.strictEqual(later.sync.pending, 1);

    echo(later.harness, 0, 3);

    assert.strictEqual(later.sync.pending, 0);
    assert.deepEqual(later.applied, [3]);
  });

  test("refuses a restored command that fails to replay and resyncs, keeping the others", () => {
    const outbox = new MemoryOutbox();
    const left: TestCommand[] = [
      { action: "set", value: -1, clientId: "A", seq: 1, timestamp: 0 },
      { action: "set", value: 5, clientId: "A", seq: 0, timestamp: 0 }
    ];
    left.forEach((command) => outbox.keep(command));
    const { harness, applied, refused } = open(outbox);
    harness.admit("B");
    harness.serverMessage({ type: "snapshot", data: { value: 0 }, version: 0 });

    assert.deepEqual(refused, [-1]);
    assert.deepEqual(applied, [5]);
    assert.deepEqual(sentCommands(harness), ["B:1:5"]);
    assert.ok(harness.sent.some((envelope) => envelope.kind === "resync"));
    assert.deepEqual(outbox.commands, ["B:1:5"]);
  });

  test("refuses an outbox once the room has joined", () => {
    const harness = new RoomHarness<TestCommand, TestMessage>();
    const sync = new CommandSync<TestCommand, TestSnapshot>(harness.room);
    harness.room.join();
    harness.admit("A");

    assert.throws(() => sync.keepIn(new MemoryOutbox()));
  });
});
