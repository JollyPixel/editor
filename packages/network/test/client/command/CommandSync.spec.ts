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
  type SentChange
} from "#src/index.ts";
import { RoomHarness } from "../../helpers/client/RoomHarness.ts";
import {
  createCommandSync,
  remote,
  type TestCommand,
  type TestMessage,
  type TestNotice,
  type TestSnapshot
} from "../../helpers/client/commandSync.ts";

class ChangeSync extends CommandSync<TestCommand, TestSnapshot, TestNotice> {
  sendValue(
    value: number,
    change: SentChange
  ): TestCommand {
    return this.sendChange({ action: "set", value }, change);
  }
}

describe("CommandSync", () => {
  test("send stamps the room clientId, an incrementing seq and a timestamp", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const { harness, sync } = createCommandSync();

    sync.send({ action: "set", value: 1 });
    sync.send({ action: "set", value: 2 }, 50);

    assert.deepEqual(harness.messages, [
      { action: "set", value: 1, clientId: "self", seq: 1, timestamp: 1000 },
      { action: "set", value: 2, clientId: "self", seq: 2, timestamp: 50 }
    ]);
  });

  test("holds commands sent before admission and stamps them once the room syncs", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const { harness, sync } = createCommandSync({ admitted: false });

    sync.send({ action: "set", value: 1 });
    assert.deepEqual(harness.messages, []);

    harness.admit("A");

    assert.deepEqual(harness.messages, [
      { action: "set", value: 1, clientId: "A", seq: 1, timestamp: 1000 }
    ]);
  });

  test("emits commands from other clients and drops its own echoes", () => {
    const { harness, sync } = createCommandSync();
    const commands: TestCommand[] = [];
    sync.on("command", (command) => commands.push(command));

    harness.serverMessage({ type: "command", data: remote("self") });
    harness.serverMessage({ type: "command", data: remote("peer") });

    assert.deepEqual(commands, [remote("peer")]);
  });

  test("send returns the pending command, and the room receives a copy", () => {
    const { harness, sync } = createCommandSync();

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
    const { harness, sync } = createCommandSync();
    const ready = sync.whenReady();

    harness.serverMessage({ type: "snapshot", data: { value: 1 } });

    await ready;
    assert.strictEqual(sync.whenReady(), ready);
  });

  test("emits every snapshot, and ready once after the first", () => {
    const { harness, sync } = createCommandSync();
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
    const { harness, sync } = createCommandSync();
    const notices: TestNotice[] = [];
    sync.on("notice", (notice) => notices.push(notice));

    harness.serverMessage({ type: "rejected", reason: "disk full" });

    assert.deepEqual(notices, [{ type: "rejected", reason: "disk full" }]);
  });

  test("destroy stops handling room messages and discards held commands", () => {
    const { harness, sync } = createCommandSync({ admitted: false });
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
