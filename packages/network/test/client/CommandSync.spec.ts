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
import { FakeRoom } from "../helpers/FakeRoom.ts";

type TestCommand = { action: "set"; value: number; } & NetworkCommandHeader;

interface TestSnapshot {
  value: number;
}

interface TestNotice {
  type: "rejected";
  reason: string;
}

type TestMessage = NetworkServerMessage<TestCommand, TestSnapshot, TestNotice>;

function setup() {
  const room = new FakeRoom<TestCommand, TestMessage>();
  const sync = new CommandSync<TestCommand, TestSnapshot, TestNotice>(room);

  return {
    room,
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
    const { room, sync } = setup();

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 }, 50);

    assert.deepEqual(room.sent, [
      { action: "set", value: 1, clientId: "self", seq: 1, timestamp: 1000 },
      { action: "set", value: 2, clientId: "self", seq: 2, timestamp: 50 }
    ]);
  });

  test("emits commands from other clients and drops its own echoes", () => {
    const { room, sync } = setup();
    const commands: TestCommand[] = [];
    sync.on("command", (command) => commands.push(command));

    room.emit("message", { type: "command", data: remote("self") });
    room.emit("message", { type: "command", data: remote("peer") });

    assert.deepEqual(commands, [remote("peer")]);
  });

  test("emits every snapshot, and ready once after the first", () => {
    const { room, sync } = setup();
    const events: string[] = [];
    sync.on("snapshot", (snapshot) => events.push(`snapshot:${snapshot.value}`));
    sync.on("ready", () => events.push("ready"));

    assert.strictEqual(sync.ready, false);
    room.emit("message", { type: "snapshot", data: { value: 1 } });
    room.emit("message", { type: "snapshot", data: { value: 2 } });

    assert.strictEqual(sync.ready, true);
    assert.deepEqual(events, ["snapshot:1", "ready", "snapshot:2"]);
  });

  test("emits any other message as a notice", () => {
    const { room, sync } = setup();
    const notices: TestNotice[] = [];
    sync.on("notice", (notice) => notices.push(notice));

    room.emit("message", { type: "rejected", reason: "disk full" });

    assert.deepEqual(notices, [{ type: "rejected", reason: "disk full" }]);
  });

  test("destroy stops handling room messages", () => {
    const { room, sync } = setup();
    let snapshots = 0;
    sync.on("snapshot", () => snapshots++);

    sync.destroy();
    room.emit("message", { type: "snapshot", data: { value: 1 } });

    assert.strictEqual(snapshots, 0);
    assert.strictEqual(sync.ready, false);
  });
});
