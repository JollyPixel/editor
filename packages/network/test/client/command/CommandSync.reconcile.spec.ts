// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createReconciledSync,
  move,
  paint
} from "../../helpers/client/reconciledSync.ts";

describe("CommandSync reconciliation, keyed writes", () => {
  test("drops a remote write to a key a pending write outlives", () => {
    const { harness, sync, log } = createReconciledSync();

    sync.send({ action: "paint", keys: ["k"], value: 1 }, 200);
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 100) });

    assert.deepEqual(log, []);
  });

  test("a pending write outlives a versioned remote write whatever the clocks say", () => {
    const { harness, sync, log } = createReconciledSync();

    sync.send({ action: "paint", keys: ["k"], value: 1 }, 100);
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 9_000), version: 3 });

    assert.deepEqual(log, []);
  });

  test("a pending replay older than the remote version lets the remote write through", () => {
    const { harness, sync, log } = createReconciledSync();

    sync.send({ action: "paint", keys: ["k"], value: 1 }, 100, 2);
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 50), version: 3 });

    assert.deepEqual(log, ["apply:peer:paint:k=0"]);
  });

  test("applies a remote write that beats the pending write", () => {
    const { harness, sync, log } = createReconciledSync();

    sync.send({ action: "paint", keys: ["k"], value: 1 }, 100);
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 200) });

    assert.deepEqual(log, ["apply:peer:paint:k=0"]);
  });

  test("narrows a remote write to the keys no pending write outlives", () => {
    const { harness, sync, log } = createReconciledSync();

    sync.send({ action: "paint", keys: ["b"], value: 1 }, 200);
    harness.serverMessage({ type: "command", data: paint("peer", ["a", "b", "c"], 100) });

    assert.deepEqual(log, ["apply:peer:paint:a+c=0"]);
  });

  test("applies a write it cannot narrow, then replays the pending writes that outlive it", () => {
    const { harness, sync, log } = createReconciledSync({ narrows: false });

    sync.send({ action: "paint", keys: ["b"], value: 1 }, 200);
    sync.send({ action: "paint", keys: ["z"], value: 2 }, 200);
    harness.serverMessage({ type: "command", data: paint("peer", ["a", "b"], 100) });

    assert.deepEqual(log, ["apply:peer:paint:a+b=0", "replay:1"]);
  });

  test("applies a remote write as is when the ledger is empty", () => {
    const { harness, log } = createReconciledSync();

    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 100) });

    assert.deepEqual(log, ["apply:peer:paint:k=0"]);
  });

  test("a correction is masked by a later pending write on the same key", () => {
    const { harness, sync, log } = createReconciledSync();

    sync.send({ action: "paint", keys: ["k"], value: 1 }, 100);
    sync.send({ action: "paint", keys: ["k"], value: 2 }, 150);
    harness.serverMessage({
      type: "correction",
      data: { ...paint("self", ["k"], 100, 9), seq: 1 },
      acks: { self: 1 }
    });

    assert.deepEqual(log, []);
    assert.strictEqual(sync.pending, 1);
  });
});

describe("CommandSync reconciliation, structural commands", () => {
  test("reverts pending commands, applies the remote command, then replays them", () => {
    const { harness, sync, log } = createReconciledSync();

    sync.send({ action: "move", item: "a" });
    sync.send({ action: "paint", keys: ["k"], value: 1 }, 100);
    harness.serverMessage({ type: "command", data: move("peer") });

    assert.deepEqual(log, [
      "revert:1,2",
      "apply:peer:move:a",
      "replay:1",
      "replay:2"
    ]);
  });

  test("a keyed remote write takes the slow path while a structural command is pending", () => {
    const { harness, sync, log } = createReconciledSync();

    sync.send({ action: "move", item: "a" });
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 100) });

    assert.deepEqual(log, [
      "revert:1",
      "apply:peer:paint:k=0",
      "replay:1"
    ]);
  });

  test("a pending command the view rejects is left out of the next revert", () => {
    const { harness, sync, log } = createReconciledSync({
      replays: (command) => command.seq !== 1
    });

    sync.send({ action: "move", item: "a" });
    sync.send({ action: "move", item: "b" });
    harness.serverMessage({ type: "command", data: move("peer") });
    harness.serverMessage({ type: "command", data: move("peer") });

    assert.deepEqual(log.slice(4), [
      "revert:2",
      "apply:peer:move:a",
      "replay:1",
      "replay:2"
    ]);
  });

  test("applies the echo of a command the view rejected but the server admitted", () => {
    const { harness, sync, log } = createReconciledSync({
      replays: (command) => command.seq !== 1
    });

    sync.send({ action: "move", item: "a" });
    harness.serverMessage({ type: "command", data: move("peer") });
    log.length = 0;
    harness.serverMessage({ type: "command", data: move("self", 1) });

    assert.deepEqual(log, ["apply:self:move:a"]);
    assert.strictEqual(sync.pending, 0);
  });

  test("an own echo of an applied command is not applied again", () => {
    const { harness, sync, log } = createReconciledSync();

    sync.send({ action: "move", item: "a" });
    harness.serverMessage({ type: "command", data: move("self", 1) });

    assert.deepEqual(log, []);
  });
});

describe("CommandSync reconciliation, snapshots and resync", () => {
  test("a snapshot replays the unacknowledged commands through the reconciler", () => {
    const { harness, sync, log } = createReconciledSync();

    sync.send({ action: "move", item: "a" });
    sync.send({ action: "move", item: "b" });
    harness.serverMessage({ type: "snapshot", data: { value: 1 }, acks: { self: 1 } });

    assert.deepEqual(log, ["snapshot:1", "replay:2"]);
  });

  test("asks for a snapshot when a pending command cannot be reverted", () => {
    const { harness, sync, log } = createReconciledSync({ revertible: false });

    sync.send({ action: "move", item: "a" });
    harness.serverMessage({ type: "command", data: move("peer") });

    assert.deepEqual(harness.sent.at(-1), {
      room: "room",
      kind: "resync"
    });
    assert.deepEqual(log, []);
  });

  test("ignores server commands until the requested snapshot arrives", () => {
    const { harness, sync, log } = createReconciledSync({ revertible: false });

    sync.send({ action: "move", item: "a" });
    sync.send({ action: "move", item: "b" });
    harness.serverMessage({ type: "command", data: move("peer") });
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 1) });
    harness.serverMessage({ type: "command", data: move("self", 1) });
    harness.serverMessage({ type: "snapshot", data: { value: 5 }, acks: { self: 1 } });

    assert.deepEqual(log, ["snapshot:5", "replay:2"]);
    assert.strictEqual(sync.pending, 1);
  });

  test("an own echo ignored while resyncing still reports its version", () => {
    const { harness, sync } = createReconciledSync({ revertible: false });
    const versions: Array<number | undefined> = [];
    sync.on("acknowledged", (_command, version) => versions.push(version));

    sync.send({ action: "move", item: "a" });
    harness.serverMessage({ type: "command", data: move("peer") });
    harness.serverMessage({ type: "command", data: move("self", 1), version: 4 });

    assert.deepEqual(versions, [4]);
  });

  test("asks for one snapshot at a time", () => {
    const { harness, sync } = createReconciledSync({ revertible: false });

    sync.send({ action: "move", item: "a" });
    harness.serverMessage({ type: "command", data: move("peer") });
    harness.serverMessage({ type: "command", data: move("peer") });

    assert.strictEqual(
      harness.sent.filter((envelope) => envelope.kind === "resync").length,
      1
    );
  });
});
