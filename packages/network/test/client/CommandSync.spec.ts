// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CommandSync,
  type NetworkCommandHeader,
  type NetworkServerMessage
} from "#src/index.ts";
import { RoomHarness } from "../helpers/RoomHarness.ts";

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

  test("after a snapshot, emits own echoes of commands sent before it", () => {
    const { harness, sync } = setup();
    const seqs: number[] = [];
    sync.on("command", (command) => seqs.push(command.seq));

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 });
    harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 1 } });
    harness.serverMessage({ type: "snapshot", data: { value: 1 } });
    sync.send({ action: "set", value: 3 });
    harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 2 } });
    harness.serverMessage({ type: "command", data: { ...remote("self"), seq: 3 } });

    assert.deepEqual(seqs, [2]);
  });

  test("counts held commands in the replay range of a snapshot", () => {
    const { harness, sync } = setup({ admitted: false });
    const seqs: number[] = [];
    sync.on("command", (command) => seqs.push(command.seq));

    sync.send({ action: "set", value: 1 });
    harness.serverMessage({ type: "snapshot", data: { value: 0 } });
    harness.admit("A");
    harness.serverMessage({ type: "command", data: { ...remote("A"), seq: 1 } });

    assert.deepEqual(seqs, [1]);
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
});
