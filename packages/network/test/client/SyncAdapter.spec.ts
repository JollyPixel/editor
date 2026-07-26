// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  SyncAdapter,
  type Room,
  type NetworkCommandHeader,
  type NetworkServerMessage
} from "#src/index.ts";

// ---------------------------------------------------------------------------
// A minimal concrete target/event/command triple, standing in for a real
// domain (PixelArtCanvas + PixelBufferHookEvent, VoxelEngine + VoxelLayerHookEvent, ...).
// ---------------------------------------------------------------------------

interface TestEvent {
  action: string;
}

type TestCommand = TestEvent & NetworkCommandHeader;

interface TestSnapshot {
  value: string;
}

interface TestTarget {
  onUpdated: ((event: TestEvent) => void) | undefined;
  appliedCommands: TestCommand[];
  loadedSnapshots: TestSnapshot[];
  triggerLocal(event: TestEvent): void;
}

function createTarget(): TestTarget {
  let listener: ((event: TestEvent) => void) | undefined;
  const target: TestTarget = {
    get onUpdated() {
      return listener;
    },
    set onUpdated(fn) {
      listener = fn;
    },
    appliedCommands: [],
    loadedSnapshots: [],
    triggerLocal(event) {
      listener?.(event);
    }
  } as unknown as TestTarget;

  return target;
}

class TestSyncClient extends SyncAdapter<TestTarget, TestEvent, TestCommand, TestSnapshot> {
  protected getHandler(
    target: TestTarget
  ): ((event: TestEvent) => void) | undefined {
    return target.onUpdated;
  }

  protected setHandler(
    target: TestTarget,
    fn: ((event: TestEvent) => void) | undefined
  ): void {
    target.onUpdated = fn;
  }

  protected applySnapshot(
    target: TestTarget,
    snapshot: TestSnapshot
  ): void {
    target.loadedSnapshots.push(snapshot);
  }

  protected applyRemoteCommand(
    target: TestTarget,
    cmd: TestCommand
  ): void {
    target.appliedCommands.push(cmd);
  }
}

interface MockRoom extends Room<TestCommand, NetworkServerMessage<TestCommand, TestSnapshot>> {
  sentCommands: TestCommand[];
  simulateCommand(cmd: TestCommand): void;
  simulateSnapshot(snapshot: TestSnapshot): void;
}

function createMockRoom(
  clientId = "client-A"
): MockRoom {
  const sentCommands: TestCommand[] = [];
  const events = new EventTarget();

  const room: MockRoom = {
    id: "test-room",
    clientId,
    peers: new Map(),
    sentCommands,
    addEventListener: (type, listener, options) => events.addEventListener(type, listener as EventListener, options),
    removeEventListener: (type, listener, options) => events.removeEventListener(
      type,
      listener as EventListener,
      options
    ),
    join() {
      // Unused by SyncAdapter.
    },
    send(cmd) {
      sentCommands.push(cmd);
    },
    updatePresence() {
      // Unused by SyncAdapter.
    },
    leave() {
      // Unused by SyncAdapter.
    },
    simulateCommand(cmd) {
      events.dispatchEvent(new CustomEvent("message", { detail: { type: "command", data: cmd } }));
    },
    simulateSnapshot(snapshot) {
      events.dispatchEvent(new CustomEvent("message", { detail: { type: "snapshot", data: snapshot } }));
    }
  };

  return room;
}

describe("SyncAdapter — attach / detach", () => {
  test("sets the target's handler", () => {
    const target = createTarget();
    const client = new TestSyncClient(createMockRoom());

    assert.equal(target.onUpdated, undefined);
    client.attach(target);
    assert.ok(target.onUpdated !== undefined);
  });

  test("throws when a target is already attached", () => {
    const client = new TestSyncClient(createMockRoom());
    client.attach(createTarget());

    assert.throws(() => client.attach(createTarget()));
  });

  test("attach preserves an existing local handler instead of replacing it", () => {
    const target = createTarget();
    const received: TestEvent[] = [];
    target.onUpdated = (event) => received.push(event);

    const room = createMockRoom("client-A");
    const client = new TestSyncClient(room);
    client.attach(target);

    target.triggerLocal({ action: "a" });

    assert.equal(received.length, 1);
    assert.equal(room.sentCommands.length, 1);
  });

  test("detach restores the handler that was present before attach", () => {
    const target = createTarget();
    const received: TestEvent[] = [];
    function original(event: TestEvent): void {
      received.push(event);
    }
    target.onUpdated = original;

    const room = createMockRoom();
    const client = new TestSyncClient(room);
    client.attach(target);
    client.detach();

    assert.equal(target.onUpdated, original);

    target.triggerLocal({ action: "a" });
    assert.equal(received.length, 1);
    assert.equal(room.sentCommands.length, 0);
  });

  test("detach without an attached target is a no-op", () => {
    const client = new TestSyncClient(createMockRoom());
    assert.doesNotThrow(() => client.detach());
  });
});

describe("SyncAdapter — local mutations forwarded to the room", () => {
  test("stamps each command with clientId, an incrementing seq and a timestamp", () => {
    const target = createTarget();
    const room = createMockRoom("client-B");
    const before = Date.now();
    const client = new TestSyncClient(room);
    client.attach(target);

    target.triggerLocal({ action: "a" });
    target.triggerLocal({ action: "b" });

    assert.equal(room.sentCommands[0].clientId, "client-B");
    assert.ok(room.sentCommands[0].timestamp >= before);
    assert.equal(room.sentCommands[0].seq, 1);
    assert.equal(room.sentCommands[1].seq, 2);
  });
});

describe("SyncAdapter — remote commands applied without re-emitting", () => {
  test("applies commands from a different client to the target", () => {
    const target = createTarget();
    const room = createMockRoom("client-A");
    const client = new TestSyncClient(room);
    client.attach(target);

    room.simulateCommand({ action: "a", clientId: "client-B", seq: 1, timestamp: Date.now() });

    assert.equal(target.appliedCommands.length, 1);
  });

  test("does NOT apply commands from the local client (echo prevention)", () => {
    const target = createTarget();
    const room = createMockRoom("client-A");
    const client = new TestSyncClient(room);
    client.attach(target);

    room.simulateCommand({ action: "a", clientId: "client-A", seq: 1, timestamp: Date.now() });

    assert.equal(target.appliedCommands.length, 0);
  });

  test("ignores commands when no target is attached", () => {
    const room = createMockRoom("client-A");
    new TestSyncClient(room);

    assert.doesNotThrow(() => {
      room.simulateCommand({ action: "a", clientId: "client-B", seq: 1, timestamp: Date.now() });
    });
  });
});

describe("SyncAdapter — snapshot loading", () => {
  test("applies a snapshot to the target and flips ready", () => {
    const target = createTarget();
    const room = createMockRoom();
    const client = new TestSyncClient(room);
    client.attach(target);

    assert.equal(client.ready, false);
    room.simulateSnapshot({ value: "hello" });

    assert.equal(target.loadedSnapshots.length, 1);
    assert.equal(client.ready, true);
  });

  test("fires the ready event exactly once", () => {
    const room = createMockRoom();
    const client = new TestSyncClient(room);
    client.attach(createTarget());

    let fired = 0;
    client.addEventListener("ready", () => fired++);

    room.simulateSnapshot({ value: "a" });
    room.simulateSnapshot({ value: "b" });

    assert.equal(fired, 1);
  });

  test("ignores a snapshot when no target is attached", () => {
    const room = createMockRoom();
    new TestSyncClient(room);

    assert.doesNotThrow(() => {
      room.simulateSnapshot({ value: "a" });
    });
  });
});

describe("SyncAdapter — destroy", () => {
  test("detaches the target and stops listening for room messages", () => {
    const target = createTarget();
    const room = createMockRoom();
    const client = new TestSyncClient(room);
    client.attach(target);

    client.destroy();

    assert.equal(target.onUpdated, undefined);
    room.simulateSnapshot({ value: "late" });
    assert.equal(target.loadedSnapshots.length, 0);
  });

  test("stops forwarding local mutations after destroy", () => {
    const target = createTarget();
    const room = createMockRoom();
    const client = new TestSyncClient(room);
    client.attach(target);

    client.destroy();
    target.triggerLocal({ action: "a" });

    assert.equal(room.sentCommands.length, 0);
  });
});
