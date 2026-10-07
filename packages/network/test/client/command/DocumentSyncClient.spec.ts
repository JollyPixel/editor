// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CommandDocument,
  type CommandChange
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
  value: number;
}

type TestCommand = SetCommand & NetworkCommandHeader;

interface TestSnapshot {
  value: number;
}

type TestMessage = NetworkServerMessage<TestCommand, TestSnapshot>;

class ValueDocument extends CommandDocument<SetCommand, TestSnapshot, number> {
  readonly changes: CommandChange<SetCommand, number>[] = [];
  readonly loads: number[];
  #state: { value: number; };

  constructor() {
    const state = { value: 0 };
    const loads: number[] = [];
    super({
      accepts: () => true,
      placeable: (command) => command,
      apply: ({ value }) => {
        state.value = value;
      },
      load: ({ value }) => {
        loads.push(value);
        state.value = value;
      },
      imageOf: () => state.value,
      inverseOf: () => [{ action: "set", value: state.value }],
      restored: (images) => {
        return { value: images[0] };
      }
    });
    this.#state = state;
    this.loads = loads;
    this.subscribe("change", (change) => this.changes.push(change));
  }

  get value(): number {
    return this.#state.value;
  }

  set(
    value: number
  ): void {
    this.commit({ action: "set", value });
  }
}

function setup(
  keys: (command: TestCommand) => readonly string[] | null = () => null
) {
  const harness = new RoomHarness<TestCommand, TestMessage>();
  harness.room.join();
  harness.admit("self");
  const document = new ValueDocument();
  const sync = new DocumentSyncClient(harness.room, {
    document,
    keys
  });

  return { harness, document, sync };
}

function peer(
  value: number
): TestCommand {
  return {
    action: "set",
    value,
    clientId: "peer",
    seq: value,
    timestamp: 1
  };
}

describe("DocumentSyncClient", () => {
  test("sends a local change with its basis and confirms it when its echo lands", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 100 });
    const { harness, document } = setup();
    const confirmed: Array<[CommandChange<SetCommand, number>, number | undefined]> = [];
    document.receipts.on("confirmed", (change, version) => confirmed.push([change, version]));

    const local = document.applyStep({ action: "set", value: 1 }, 4)!;
    document.apply({ action: "set", value: 2 }, "peer");

    const sent: TestCommand = { action: "set", value: 1, clientId: "self", seq: 1, timestamp: 100, basis: 4 };
    assert.deepEqual(harness.messages, [sent]);

    harness.serverMessage({ type: "command", data: sent, version: 7 });
    assert.deepEqual(confirmed, [[local, 7]]);
  });

  test("a peer command reverts the pending changes from their images, applies, and replays them", () => {
    const { harness, document } = setup();
    harness.serverMessage({ type: "snapshot", data: { value: 3 } });

    document.set(4);
    harness.serverMessage({
      type: "command",
      data: { action: "set", value: 5, clientId: "peer", seq: 1, timestamp: 1 },
      version: 1
    });

    assert.deepEqual(document.loads, [3, 3]);
    assert.deepEqual(
      document.changes.map(({ origin, clientId, command }) => [origin, clientId, command.value]),
      [["local", null, 4], ["remote", "peer", 5], ["replay", null, 4]]
    );
    assert.equal(document.value, 4);
  });

  test("refuses the original local change when the server refuses it after a replay", () => {
    const { harness, document } = setup();
    const refused: CommandChange<SetCommand, number>[] = [];
    document.receipts.on("refused", (change) => refused.push(change));
    harness.serverMessage({ type: "snapshot", data: { value: 3 } });

    document.set(4);
    const [local] = document.changes;
    harness.serverMessage({
      type: "command",
      data: { action: "set", value: 5, clientId: "peer", seq: 1, timestamp: 1 },
      version: 1
    });
    harness.serverMessage({ type: "snapshot", data: { value: 5 }, acks: { self: 1 }, refused: 1 });

    assert.deepEqual(refused, [local]);
  });

  test("a keyed peer write it cannot narrow applies whole, then the outliving change replays", () => {
    const { harness, document } = setup((command) => (
      command.clientId === "peer" ? ["value", "label"] : ["value"]
    ));
    harness.serverMessage({ type: "snapshot", data: { value: 3 }, version: 1 });

    document.set(4);
    harness.serverMessage({ type: "command", data: peer(5), version: 2 });

    assert.deepEqual(
      document.changes.map(({ origin, command }) => [origin, command.value]),
      [["local", 4], ["remote", 5], ["replay", 4]]
    );
    assert.equal(document.value, 4);
  });

  test("a command sent around the document has no image, so a rebase asks for a snapshot", () => {
    const { harness, sync, document } = setup();
    harness.serverMessage({ type: "snapshot", data: { value: 3 } });

    sync.send({ action: "set", value: 4 });
    harness.serverMessage({ type: "command", data: peer(5), version: 1 });

    assert.deepEqual(harness.sent.at(-1), { room: "room", kind: "resync" });
    assert.equal(document.value, 3);
  });

  test("stops sending and writing receipts once destroyed", () => {
    const { harness, document, sync } = setup();

    sync.destroy();
    document.set(6);

    assert.deepEqual([harness.messages, document.receipts.attached], [[], false]);
  });
});
