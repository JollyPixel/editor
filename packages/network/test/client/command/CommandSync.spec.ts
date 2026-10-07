// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ChangeReceipts } from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  CommandSync,
  type NetworkCommandHeader,
  type NetworkServerMessage,
  type SentChange
} from "#src/index.ts";
import { RoomHarness } from "../../helpers/client/RoomHarness.ts";

type TestCommand = { action: "set"; value: number; } & NetworkCommandHeader;

interface TestSnapshot {
  value: number;
}

interface TestNotice {
  type: "rejected";
  reason: string;
}

type TestMessage = NetworkServerMessage<TestCommand, TestSnapshot, TestNotice>;

function setup(
  options: { admitted: boolean; } = { admitted: true }
) {
  const harness = new RoomHarness<TestCommand, TestMessage>();
  if (options.admitted) {
    harness.admit();
  }
  const sync = new CommandSync<TestCommand, TestSnapshot, TestNotice>(harness.room);

  return {
    harness,
    sync
  };
}

class ChangeSync extends CommandSync<TestCommand, TestSnapshot, TestNotice> {
  sendValue(
    value: number,
    change: SentChange
  ): TestCommand {
    return this.sendChange({ action: "set", value }, change);
  }
}

function remote(
  clientId: string
): TestCommand {
  return {
    action: "set",
    value: 1,
    clientId,
    seq: 1,
    timestamp: 1
  };
}

describe("CommandSync", () => {
  test("send stamps the room clientId, an incrementing seq and a timestamp", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const { harness, sync } = setup();

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 }, 50);

    assert.deepEqual(harness.messages, [
      { action: "set", value: 1, clientId: "self", seq: 1, timestamp: 1000 },
      { action: "set", value: 2, clientId: "self", seq: 2, timestamp: 50 }
    ]);
  });

  test("holds commands sent before admission and stamps them once the room syncs", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const { harness, sync } = setup({ admitted: false });

    sync.send({ action: "set", value: 1 });
    assert.deepEqual(harness.messages, []);

    harness.admit("A");

    assert.deepEqual(harness.messages, [
      { action: "set", value: 1, clientId: "A", seq: 1, timestamp: 1000 }
    ]);
  });

  test("emits commands from other clients and drops its own echoes", () => {
    const { harness, sync } = setup();
    const commands: TestCommand[] = [];
    sync.on("command", (command) => commands.push(command));

    harness.serverMessage({ type: "command", data: remote("self") });
    harness.serverMessage({ type: "command", data: remote("peer") });

    assert.deepEqual(commands, [remote("peer")]);
  });

  test("a snapshot replays the pending commands its acks do not cover", () => {
    const { harness, sync } = setup();
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
    const { harness, sync } = setup();
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
    const { harness, sync } = setup();

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    harness.serverMessage({
      type: "correction",
      data: { ...remote("self"), value: 0, seq: 1 }
    });

    assert.strictEqual(sync.pending, 1);
  });

  test("tells which own command the server refused, only when the snapshot or correction names it", () => {
    const { harness, sync } = setup();
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
    const { harness, sync } = setup();
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
    const { harness, sync } = setup({ admitted: false });
    const values: number[] = [];
    sync.on("command", (command) => values.push(command.value));

    sync.send({ action: "set", value: 1 });
    harness.admit("A");
    harness.serverMessage({ type: "snapshot", data: { value: 0 } });
    harness.serverMessage({ type: "command", data: { ...remote("A"), seq: 1 } });

    assert.deepEqual(values, [1]);
    assert.strictEqual(sync.pending, 0);
  });

  test("an own echo acknowledges every command up to its seq", () => {
    const { harness, sync } = setup();

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    sync.send({ action: "set", value: 3 });
    assert.strictEqual(sync.pending, 3);

    harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 2 } });

    assert.strictEqual(sync.pending, 1);
  });

  test("emits settled when the last pending command is acknowledged", () => {
    const { harness, sync } = setup();
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

  test("send returns the pending command, and the room receives a copy", () => {
    const { harness, sync } = setup();

    const pending = sync.send({ action: "set", value: 1 }, 10);

    assert.deepEqual(pending, {
      action: "set",
      value: 1,
      clientId: "self",
      seq: 1,
      timestamp: 10
    });
    assert.notStrictEqual(harness.messages[0], pending);
  });

  test("whenReady resolves on the first snapshot", async() => {
    const { harness, sync } = setup();
    const ready = sync.whenReady();

    harness.serverMessage({ type: "snapshot", data: { value: 1 } });

    await ready;
    assert.strictEqual(sync.whenReady(), ready);
  });

  test("emits every snapshot, and ready once after the first", () => {
    const { harness, sync } = setup();
    const events: string[] = [];
    sync.on("snapshot", (snapshot) => events.push(`snapshot:${snapshot.value}`));
    sync.on("ready", () => events.push("ready"));

    assert.strictEqual(sync.ready, false);
    harness.serverMessage({ type: "snapshot", data: { value: 1 } });
    harness.serverMessage({ type: "snapshot", data: { value: 2 } });

    assert.strictEqual(sync.ready, true);
    assert.deepEqual(events, ["snapshot:1", "ready", "snapshot:2"]);
  });

  test("emits any other message as a notice", () => {
    const { harness, sync } = setup();
    const notices: TestNotice[] = [];
    sync.on("notice", (notice) => notices.push(notice));

    harness.serverMessage({ type: "rejected", reason: "disk full" });

    assert.deepEqual(notices, [{ type: "rejected", reason: "disk full" }]);
  });

  test("destroy stops handling room messages and discards held commands", () => {
    const { harness, sync } = setup({ admitted: false });
    let snapshots = 0;
    sync.on("snapshot", () => snapshots++);
    sync.send({ action: "set", value: 1 });

    sync.destroy();
    harness.admit();
    harness.serverMessage({ type: "snapshot", data: { value: 1 } });

    assert.strictEqual(snapshots, 0);
    assert.strictEqual(sync.ready, false);
    assert.deepEqual(harness.messages, []);
  });

  test("writes the answers about changes sent with sendChange to its receipts, until destroyed", () => {
    const harness = new RoomHarness<TestCommand, TestMessage>();
    harness.admit();
    const receipts = new ChangeReceipts<SentChange>();
    const sync = new ChangeSync(harness.room, { receipts });
    const first = { basis: 2 };
    const second = {};
    const answers: string[] = [];
    function nameOf(
      change: SentChange
    ): string {
      return change === first ? "first" : "second";
    }
    receipts.on("confirmed", (change, version) => answers.push(`${nameOf(change)}@${version}`));
    receipts.on("refused", (change) => answers.push(`${nameOf(change)} refused`));

    sync.sendValue(1, first);
    sync.sendValue(2, second);
    sync.send({ action: "set", value: 3 });
    harness.serverMessage({
      type: "snapshot",
      data: { value: 0 },
      version: 4,
      acks: { self: 3 },
      refused: 2
    });
    sync.destroy();

    assert.equal((harness.messages as TestCommand[])[0].basis, 2);
    assert.deepEqual(answers, ["first@4", "second refused"]);
    assert.equal(receipts.attached, false);
  });
});
