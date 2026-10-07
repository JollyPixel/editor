// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CommandDocument,
  CommandHistory,
  KeyedGuard
} from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  DocumentSyncClient,
  type NetworkCommandHeader,
  type NetworkServerMessage
} from "#src/client/index.ts";
import { RoomHarness } from "../../helpers/client/RoomHarness.ts";

interface SetCommand {
  action: "set";
  key: string;
  value: number;
}

interface SetImage {
  key: string;
  value: number;
}

type Snapshot = Record<string, number>;

type TestCommand = SetCommand & NetworkCommandHeader;

type TestMessage = NetworkServerMessage<TestCommand, Snapshot>;

class KeyValueDocument extends CommandDocument<SetCommand, Snapshot, SetImage> {
  readonly values: Map<string, number>;

  constructor() {
    const values = new Map<string, number>();
    super({
      accepts: () => true,
      placeable: (command) => command,
      apply: ({ key, value }) => {
        values.set(key, value);
      },
      load: (snapshot) => {
        values.clear();
        for (const [key, value] of Object.entries(snapshot)) {
          values.set(key, value);
        }
      },
      imageOf: ({ key }) => {
        return { key, value: values.get(key) ?? 0 };
      },
      inverseOf: ({ key }) => [{ action: "set", key, value: values.get(key) ?? 0 }],
      restored: (images) => {
        const snapshot = Object.fromEntries(values);
        for (const { key, value } of images.toReversed()) {
          snapshot[key] = value;
        }

        return snapshot;
      }
    });
    this.values = values;
  }

  set(
    key: string,
    value: number
  ): void {
    this.commit({ action: "set", key, value });
  }
}

function setup(
  options: { keyed?: boolean; } = {}
) {
  const { keyed = true } = options;
  const harness = new RoomHarness<TestCommand, TestMessage>();
  harness.room.join();
  harness.admit("self");
  const document = new KeyValueDocument();
  const sync = new DocumentSyncClient(harness.room, {
    document,
    keys: (command) => (keyed ? [command.key] : null)
  });
  const history = new CommandHistory({ scopes: ["main"] });
  history.register({
    id: "values",
    document,
    keys: {
      written: ({ command }) => [command.key],
      guard: (commands) => new KeyedGuard(commands.map(({ key }) => {
        return { key, read: () => document.values.get(key) };
      }))
    },
    scopeOf: () => "main",
    label: ({ command }) => `Set ${command.key}`
  });
  harness.serverMessage({ type: "snapshot", data: { a: 0, b: 0 }, version: 0 });

  return {
    harness,
    sync,
    document,
    history
  };
}

function peer(
  key: string,
  value: number
): TestCommand {
  return {
    action: "set",
    key,
    value,
    clientId: "peer",
    seq: 1,
    timestamp: 1,
    basis: 0
  };
}

function lastSent(
  harness: RoomHarness<TestCommand, TestMessage>
): TestCommand {
  return harness.messages.at(-1) as TestCommand;
}

describe("CommandHistory over DocumentSyncClient", () => {
  test("a rebase leaves alone a settled step whose key a pending edit rewrote", () => {
    const { harness, document, history } = setup({ keyed: false });
    document.set("a", 1);
    harness.serverMessage({ type: "command", data: lastSent(harness), version: 1 });
    document.set("a", 2);

    harness.serverMessage({ type: "command", data: peer("b", 9), version: 2 });

    assert.deepEqual(Object.fromEntries(document.values), { a: 2, b: 9 });
    assert.deepEqual(history.state("main").refused, []);
    assert.equal(history.state("main").undoCount, 2);
  });

  test("a step a snapshot acknowledged is refused by a later peer write", () => {
    const { harness, document, history } = setup();
    document.set("a", 1);
    harness.serverMessage({ type: "snapshot", data: { a: 1, b: 0 }, version: 1, acks: { self: 1 } });

    harness.serverMessage({ type: "command", data: peer("a", 5), version: 2 });

    assert.deepEqual(history.state("main").refused, [
      { label: "Set a", refused: { reason: "peer", clientId: "peer" } }
    ]);
    assert.equal(history.undo("main"), false);
  });

  test("an undo replays with the version a snapshot acknowledged its step at", () => {
    const { harness, document, history } = setup();
    document.set("a", 1);
    harness.serverMessage({ type: "snapshot", data: { a: 1, b: 0 }, version: 4, acks: { self: 1 } });

    history.undo("main");

    assert.equal(lastSent(harness).basis, 4);
  });

  test("an undo sent before its edit is acknowledged carries basis 0", () => {
    const { harness, document, history } = setup();
    document.set("a", 1);

    history.undo("main");

    assert.deepEqual(
      [lastSent(harness).value, lastSent(harness).basis],
      [0, 0]
    );
  });

  test("edits dropped past the offline bound refuse their step", () => {
    const { harness, document, history } = setup();
    harness.room.suspend();
    history.record("main", "Fill", () => {
      for (let index = 0; index <= 500; index++) {
        document.set(`cell:${index}`, index);
      }
    });

    harness.room.rejoin();
    harness.admit("other");

    assert.deepEqual(history.state("main").refused, [
      { label: "Fill", refused: { reason: "dropped" } }
    ]);
  });
});
