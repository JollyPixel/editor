// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CommandSync,
  type CommandReconciler,
  type NetworkCommandHeader,
  type NetworkServerMessage
} from "#src/index.ts";
import { RoomHarness } from "../helpers/RoomHarness.ts";

type TestCommand = (
  | { action: "paint"; keys: string[]; value: number; }
  | { action: "move"; item: string; }
) & NetworkCommandHeader;

interface TestSnapshot {
  value: number;
}

type TestMessage = NetworkServerMessage<TestCommand, TestSnapshot>;

interface SetupOptions {
  revertible?: boolean;
  narrows?: boolean;
  replays?: (command: TestCommand) => boolean;
}

function label(
  command: TestCommand
): string {
  return command.action === "paint" ?
    `${command.clientId}:paint:${command.keys.join("+")}=${command.value}` :
    `${command.clientId}:move:${command.item}`;
}

function setup(
  options: SetupOptions = {}
) {
  const {
    revertible = true,
    narrows = true,
    replays = () => true
  } = options;
  const log: string[] = [];
  const harness = new RoomHarness<TestCommand, TestMessage>();
  harness.room.join();
  harness.admit("self");
  const reconciler: CommandReconciler<TestCommand> = {
    keys: (command) => (command.action === "paint" ? command.keys : null),
    narrow: (command, keep) => {
      if (!narrows || command.action !== "paint") {
        return null;
      }

      return {
        ...command,
        keys: keep.map((index) => command.keys[index])
      };
    },
    revert: (pending) => {
      if (!revertible) {
        return false;
      }
      log.push(`revert:${pending.map((command) => command.seq).join(",")}`);

      return true;
    },
    replay: (command) => {
      log.push(`replay:${command.seq}`);

      return replays(command);
    }
  };
  const sync = new CommandSync<TestCommand, TestSnapshot>(harness.room, {
    reconciler
  });
  sync.on("command", (command) => log.push(`apply:${label(command)}`));
  sync.on("snapshot", (snapshot) => log.push(`snapshot:${snapshot.value}`));

  return {
    harness,
    sync,
    log
  };
}

function paint(
  clientId: string,
  keys: string[],
  timestamp: number,
  value = 0
): TestCommand {
  return {
    action: "paint",
    keys,
    value,
    clientId,
    seq: 1,
    timestamp
  };
}

function move(
  clientId: string,
  seq = 1
): TestCommand {
  return {
    action: "move",
    item: "a",
    clientId,
    seq,
    timestamp: 0
  };
}

describe("CommandSync reconciliation, keyed writes", () => {
  test("drops a remote write to a key a pending write outlives", () => {
    const { harness, sync, log } = setup();

    sync.send({ action: "paint", keys: ["k"], value: 1 }, 200);
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 100) });

    assert.deepEqual(log, []);
  });

  test("a pending write outlives a versioned remote write whatever the clocks say", () => {
    const { harness, sync, log } = setup();

    sync.send({ action: "paint", keys: ["k"], value: 1 }, 100);
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 9_000), version: 3 });

    assert.deepEqual(log, []);
  });

  test("a pending replay older than the remote version lets the remote write through", () => {
    const { harness, sync, log } = setup();

    sync.send({ action: "paint", keys: ["k"], value: 1 }, 100, 2);
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 50), version: 3 });

    assert.deepEqual(log, ["apply:peer:paint:k=0"]);
  });

  test("an echo reports the version its command landed at", () => {
    const { harness, sync } = setup();
    const acknowledged: [number, number | undefined][] = [];
    sync.on("acknowledged", (command, version) => acknowledged.push([command.timestamp, version]));

    sync.send({ action: "paint", keys: ["k"], value: 1 }, 100);
    sync.send({ action: "paint", keys: ["k"], value: 2 }, 200);
    harness.serverMessage({ type: "command", data: { ...paint("self", ["k"], 200), seq: 2 }, version: 9 });

    assert.deepEqual(acknowledged, [[200, 9]]);
  });

  test("applies a remote write that beats the pending write", () => {
    const { harness, sync, log } = setup();

    sync.send({ action: "paint", keys: ["k"], value: 1 }, 100);
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 200) });

    assert.deepEqual(log, ["apply:peer:paint:k=0"]);
  });

  test("narrows a remote write to the keys no pending write outlives", () => {
    const { harness, sync, log } = setup();

    sync.send({ action: "paint", keys: ["b"], value: 1 }, 200);
    harness.serverMessage({ type: "command", data: paint("peer", ["a", "b", "c"], 100) });

    assert.deepEqual(log, ["apply:peer:paint:a+c=0"]);
  });

  test("applies a write it cannot narrow, then replays the pending writes that outlive it", () => {
    const { harness, sync, log } = setup({ narrows: false });

    sync.send({ action: "paint", keys: ["b"], value: 1 }, 200);
    sync.send({ action: "paint", keys: ["z"], value: 2 }, 200);
    harness.serverMessage({ type: "command", data: paint("peer", ["a", "b"], 100) });

    assert.deepEqual(log, ["apply:peer:paint:a+b=0", "replay:1"]);
  });

  test("applies a remote write as is when the ledger is empty", () => {
    const { harness, log } = setup();

    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 100) });

    assert.deepEqual(log, ["apply:peer:paint:k=0"]);
  });

  test("a correction is masked by a later pending write on the same key", () => {
    const { harness, sync, log } = setup();

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
    const { harness, sync, log } = setup();

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
    const { harness, sync, log } = setup();

    sync.send({ action: "move", item: "a" });
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 100) });

    assert.deepEqual(log, [
      "revert:1",
      "apply:peer:paint:k=0",
      "replay:1"
    ]);
  });

  test("a pending command the view rejects is left out of the next revert", () => {
    const { harness, sync, log } = setup({
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
    const { harness, sync, log } = setup({
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
    const { harness, sync, log } = setup();

    sync.send({ action: "move", item: "a" });
    harness.serverMessage({ type: "command", data: move("self", 1) });

    assert.deepEqual(log, []);
  });
});

describe("CommandSync reconciliation, snapshots and resync", () => {
  test("a snapshot replays the unacknowledged commands through the reconciler", () => {
    const { harness, sync, log } = setup();

    sync.send({ action: "move", item: "a" });
    sync.send({ action: "move", item: "b" });
    harness.serverMessage({ type: "snapshot", data: { value: 1 }, acks: { self: 1 } });

    assert.deepEqual(log, ["snapshot:1", "replay:2"]);
  });

  test("asks for a snapshot when a pending command cannot be reverted", () => {
    const { harness, sync, log } = setup({ revertible: false });

    sync.send({ action: "move", item: "a" });
    harness.serverMessage({ type: "command", data: move("peer") });

    assert.deepEqual(harness.sent.at(-1), {
      room: "room",
      kind: "resync"
    });
    assert.deepEqual(log, []);
  });

  test("ignores server commands until the requested snapshot arrives", () => {
    const { harness, sync, log } = setup({ revertible: false });

    sync.send({ action: "move", item: "a" });
    sync.send({ action: "move", item: "b" });
    harness.serverMessage({ type: "command", data: move("peer") });
    harness.serverMessage({ type: "command", data: paint("peer", ["k"], 1) });
    harness.serverMessage({ type: "command", data: move("self", 1) });
    harness.serverMessage({ type: "snapshot", data: { value: 5 }, acks: { self: 1 } });

    assert.deepEqual(log, ["snapshot:5", "replay:2"]);
    assert.strictEqual(sync.pending, 1);
  });

  test("asks for one snapshot at a time", () => {
    const { harness, sync } = setup({ revertible: false });

    sync.send({ action: "move", item: "a" });
    harness.serverMessage({ type: "command", data: move("peer") });
    harness.serverMessage({ type: "command", data: move("peer") });

    assert.strictEqual(
      harness.sent.filter((envelope) => envelope.kind === "resync").length,
      1
    );
  });
});
