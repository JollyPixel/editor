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
import { RoomHarness } from "../../helpers/client/RoomHarness.ts";

type TestCommand = { action: "set"; value: number; } & NetworkCommandHeader;

interface TestSnapshot {
  value: number;
}

type TestMessage = NetworkServerMessage<TestCommand, TestSnapshot>;

function remote(
  value: number
): TestCommand {
  return {
    action: "set",
    value,
    clientId: "peer",
    seq: value,
    timestamp: value
  };
}

function setup(
  applySnapshot: (snapshot: TestSnapshot) => void | Promise<void>
) {
  const harness = new RoomHarness<TestCommand, TestMessage>();
  harness.admit();
  const sync = new CommandSync<TestCommand, TestSnapshot>(harness.room, {
    applySnapshot
  });
  const events: string[] = [];
  sync.on("snapshot", (snapshot) => events.push(`snapshot ${snapshot.value}`));
  sync.on("command", (command) => events.push(`command ${command.value}`));
  sync.on("snapshot-failed", () => events.push("snapshot-failed"));

  return {
    harness,
    sync,
    events
  };
}

describe("CommandSync applySnapshot", () => {
  test("a synchronous apply loads the snapshot before it is emitted", () => {
    const applied: number[] = [];
    const { harness, sync, events } = setup((snapshot) => {
      applied.push(snapshot.value);
    });

    harness.serverMessage({ type: "snapshot", data: { value: 1 }, version: 1 });

    assert.deepEqual(applied, [1]);
    assert.deepEqual(events, ["snapshot 1"]);
    assert.strictEqual(sync.ready, true);
  });

  test("holds later messages until an asynchronous apply settles", async() => {
    const decode = Promise.withResolvers<void>();
    const { harness, sync, events } = setup(() => decode.promise);

    harness.serverMessage({ type: "snapshot", data: { value: 1 }, version: 1 });
    harness.serverMessage({ type: "command", data: remote(2), version: 2 });
    assert.deepEqual(events, []);
    assert.strictEqual(sync.ready, false);

    decode.resolve();
    await sync.whenReady();

    assert.deepEqual(events, ["snapshot 1", "command 2"]);
    assert.strictEqual(sync.version, 2);
  });

  test("a second asynchronous snapshot keeps holding the messages after it", async() => {
    const decodes = [
      Promise.withResolvers<void>(),
      Promise.withResolvers<void>()
    ];
    const { harness, events } = setup(
      (snapshot) => decodes[snapshot.value - 1].promise
    );

    harness.serverMessage({ type: "snapshot", data: { value: 1 }, version: 1 });
    harness.serverMessage({ type: "snapshot", data: { value: 2 }, version: 2 });
    harness.serverMessage({ type: "command", data: remote(3), version: 3 });
    decodes[0].resolve();
    await decodes[0].promise;
    assert.deepEqual(events, ["snapshot 1"]);

    decodes[1].resolve();
    await decodes[1].promise;

    assert.deepEqual(events, ["snapshot 1", "snapshot 2", "command 3"]);
  });

  test("a rejected apply emits snapshot-failed and releases the held messages", async() => {
    const decode = Promise.withResolvers<void>();
    const { harness, sync, events } = setup(() => decode.promise);

    harness.serverMessage({ type: "snapshot", data: { value: 1 }, version: 1 });
    harness.serverMessage({ type: "command", data: remote(2), version: 2 });
    decode.reject(new Error("corrupt pixels"));
    await decode.promise.catch(() => undefined);

    assert.deepEqual(events, ["snapshot-failed", "command 2"]);
    assert.strictEqual(sync.ready, false);
  });

  test("whenReady rejects when the first snapshot fails to load", async() => {
    const { harness, sync } = setup(() => Promise.reject(new Error("corrupt pixels")));

    harness.serverMessage({ type: "snapshot", data: { value: 1 }, version: 1 });

    await assert.rejects(sync.whenReady(), { message: "corrupt pixels" });
  });

  test("a destroyed sync ignores an apply that settles later", async() => {
    const decode = Promise.withResolvers<void>();
    const { harness, sync, events } = setup(() => decode.promise);

    harness.serverMessage({ type: "snapshot", data: { value: 1 }, version: 1 });
    sync.destroy();
    decode.resolve();
    await decode.promise;

    assert.deepEqual(events, []);
  });
});
