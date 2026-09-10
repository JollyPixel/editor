// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  BrushStore,
  ShellStore
} from "../../../src/app/state/index.ts";
import { BlockSelectionPresence } from "../../../src/features/blocks/collaboration/BlockSelectionPresence.ts";

type RoomEvent = "sync" | "peer-left" | "peer-presence";

interface PresenceHarness {
  presence: BlockSelectionPresence;
  brush: BrushStore;
  shell: ShellStore;
  published: network.PeerMetadata[];
  addPeer(clientId: string, block?: number): void;
  removePeer(clientId: string): void;
  emit(event: RoomEvent, payload?: unknown): void;
  listenerCount(event: RoomEvent): number;
}

function createHarness(): PresenceHarness {
  const peers = new Map<string, network.Peer>();
  const listeners = new Map<string, Set<(payload: any) => void>>();
  const published: network.PeerMetadata[] = [];
  const brush = new BrushStore();
  const shell = new ShellStore();

  const room = {
    id: "voxel-room",
    clientId: "local",
    peers,

    role: "default",

    rights: {},

    access: "write" as const,

    can: () => "write" as const,
    join: () => void 0,
    leave: () => void 0,
    send: () => void 0,
    updatePresence: (patch: network.PeerMetadata) => {
      published.push(patch);
    },
    on: (event: string, listener: (payload: any) => void) => {
      let bucket = listeners.get(event);
      if (!bucket) {
        bucket = new Set();
        listeners.set(event, bucket);
      }
      bucket.add(listener);
    },
    off: (event: string, listener: (payload: any) => void) => {
      listeners.get(event)?.delete(listener);
    }
  } as unknown as network.Room<any, any>;

  return {
    presence: new BlockSelectionPresence({ room, brush, shell }),
    brush,
    shell,
    published,
    addPeer(clientId, block) {
      peers.set(clientId, {
        clientId,
        role: "default",
        profile: { username: clientId, peerId: clientId },
        presence: block === undefined ? {} : { block }
      });
    },
    removePeer(clientId) {
      peers.delete(clientId);
    },
    emit(event, payload) {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    },
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0;
    }
  };
}

describe("BlockSelectionPresence", () => {
  it("publishes the local block on construction", () => {
    const harness = createHarness();

    assert.deepEqual(harness.published, [{ block: 1 }]);
    harness.presence.dispose();
  });

  it("republishes the local block on every selection change", () => {
    const harness = createHarness();
    harness.brush.blockId = 4;

    assert.deepEqual(harness.published.at(-1), { block: 4 });
    harness.presence.dispose();
  });

  it("republishes on sync because a pre-join patch is dropped", () => {
    const harness = createHarness();
    harness.published.length = 0;
    harness.emit("sync");

    assert.deepEqual(harness.published, [{ block: 1 }]);
    harness.presence.dispose();
  });

  it("folds the peer selections known at sync time", () => {
    const harness = createHarness();
    harness.addPeer("bob", 3);
    harness.addPeer("cleo", 3);
    harness.addPeer("dan", 9);
    harness.emit("sync");

    assert.deepEqual(
      [...harness.shell.blockSelections].map(([blockId, marks]) => [
        blockId,
        marks.map((mark) => mark.clientId)
      ]),
      [
        [3, ["bob", "cleo"]],
        [9, ["dan"]]
      ]
    );
    harness.presence.dispose();
  });

  it("orders the marks of a block by client id", () => {
    const harness = createHarness();
    harness.addPeer("zoe", 2);
    harness.addPeer("ada", 2);
    harness.emit("sync");

    assert.deepEqual(
      harness.shell.blockSelections.get(2)?.map((mark) => mark.clientId),
      ["ada", "zoe"]
    );
    harness.presence.dispose();
  });

  it("names and colors a mark from the peer identity", () => {
    const harness = createHarness();
    harness.addPeer("bob", 5);
    harness.emit("sync");

    const [mark] = harness.shell.blockSelections.get(5) ?? [];

    assert.equal(mark.displayName, "bob");
    assert.match(mark.color, /^#[0-9a-f]{6}$/i);
    harness.presence.dispose();
  });

  it("moves a peer mark on a presence patch", () => {
    const harness = createHarness();
    harness.addPeer("bob", 5);
    harness.emit("sync");
    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { block: 8 }
    });

    assert.equal(harness.shell.blockSelections.has(5), false);
    assert.deepEqual(
      harness.shell.blockSelections.get(8)?.map((mark) => mark.clientId),
      ["bob"]
    );
    harness.presence.dispose();
  });

  it("ignores a presence patch without a block key", () => {
    const harness = createHarness();
    harness.addPeer("bob", 5);
    harness.emit("sync");
    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { brush: null }
    });

    assert.deepEqual(
      harness.shell.blockSelections.get(5)?.map((mark) => mark.clientId),
      ["bob"]
    );
    harness.presence.dispose();
  });

  it("drops a mark when a peer clears its block", () => {
    const harness = createHarness();
    harness.addPeer("bob", 5);
    harness.emit("sync");
    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { block: null }
    });

    assert.equal(harness.shell.blockSelections.size, 0);
    harness.presence.dispose();
  });

  it("drops a mark when a peer leaves", () => {
    const harness = createHarness();
    harness.addPeer("bob", 5);
    harness.addPeer("cleo", 5);
    harness.emit("sync");
    harness.removePeer("bob");
    harness.emit("peer-left", { clientId: "bob" });

    assert.deepEqual(
      harness.shell.blockSelections.get(5)?.map((mark) => mark.clientId),
      ["cleo"]
    );
    harness.presence.dispose();
  });

  it("clears the marks and the listeners on dispose", () => {
    const harness = createHarness();
    harness.addPeer("bob", 5);
    harness.emit("sync");
    harness.presence.dispose();

    assert.equal(harness.shell.blockSelections.size, 0);
    assert.equal(harness.listenerCount("sync"), 0);
    assert.equal(harness.listenerCount("peer-left"), 0);
    assert.equal(harness.listenerCount("peer-presence"), 0);

    harness.published.length = 0;
    harness.brush.blockId = 6;
    assert.deepEqual(harness.published, []);
  });
});
