// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { Actor } from "@jolly-pixel/engine";
import type * as network from "@jolly-pixel/network";
import * as THREE from "three";

// Import Internal Dependencies
import { PeerBrushes } from "../../../src/components/brush/PeerBrushes.ts";
import { peerColor } from "../../../src/network/identity.ts";
import type { BrushCursor } from "../../../src/components/brush/cursor.ts";

type RoomEvent = "sync" | "peer-left" | "peer-presence";

interface PeerBrushesHarness {
  peers: PeerBrushes;
  presenceUpdates: network.PeerMetadata[];
  children: THREE.Object3D[];
  setPeer(
    clientId: string,
    presence: network.PeerMetadata,
    identity?: network.PeerMetadata
  ): void;
  removePeer(clientId: string): void;
  emit(event: RoomEvent, payload?: unknown): void;
  listenerCount(event: RoomEvent): number;
}

function createHarness(): PeerBrushesHarness {
  const peerMap = new Map<string, network.Peer>();
  const presenceUpdates: network.PeerMetadata[] = [];
  const children: THREE.Object3D[] = [];
  const listeners = new Map<string, Set<(payload: any) => void>>();

  const room = {
    id: "voxel-room",
    clientId: "local",
    peers: peerMap,
    join: () => void 0,
    leave: () => void 0,
    send: () => void 0,
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
    },
    updatePresence: (patch: network.PeerMetadata) => presenceUpdates.push(patch)
  } as unknown as network.Room<any, any>;

  const actorValue = {
    components: [],
    componentsRequiringUpdate: [],
    world: {
      sceneManager: {
        componentsToBeStarted: []
      }
    },
    addChildren(...objects: THREE.Object3D[]) {
      children.push(...objects);

      return actorValue;
    },
    removeChildren(...objects: THREE.Object3D[]) {
      for (const object of objects) {
        const index = children.indexOf(object);
        if (index !== -1) {
          children.splice(index, 1);
        }
      }

      return actorValue;
    }
  };
  const actor = actorValue as unknown as Actor;

  return {
    peers: new PeerBrushes(actor, { room }),
    presenceUpdates,
    children,
    setPeer(clientId, presence, identity = {}) {
      peerMap.set(clientId, {
        clientId,
        identity,
        presence
      });
    },
    removePeer(clientId) {
      peerMap.delete(clientId);
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

const kCursor: BrushCursor = {
  position: { x: 1, y: 2, z: 3 },
  size: 2
};

describe("PeerBrushes / local reporting", () => {
  test("publishes a cursor under the brush presence key", () => {
    const harness = createHarness();

    harness.peers.publishLocalCursor(kCursor);

    assert.deepStrictEqual(harness.presenceUpdates, [{ brush: kCursor }]);
  });

  test("dedupes an unchanged cursor", () => {
    const harness = createHarness();

    harness.peers.publishLocalCursor(kCursor);
    harness.peers.publishLocalCursor({ ...kCursor });

    assert.strictEqual(harness.presenceUpdates.length, 1);
  });

  test("publishes a size change on the same cell", () => {
    const harness = createHarness();

    harness.peers.publishLocalCursor(kCursor);
    harness.peers.publishLocalCursor({ ...kCursor, size: 3 });

    assert.strictEqual(harness.presenceUpdates.length, 2);
  });

  test("publishes the first null, then dedupes it", () => {
    const harness = createHarness();

    harness.peers.publishLocalCursor(null);
    harness.peers.publishLocalCursor(null);

    assert.deepStrictEqual(harness.presenceUpdates, [{ brush: null }]);
  });
});

describe("PeerBrushes / remote mirroring", () => {
  test("attaches one mesh per peer, in that peer's color", () => {
    const harness = createHarness();
    harness.setPeer(
      "client-a",
      { brush: kCursor },
      { peerId: "a" }
    );

    harness.emit("sync");

    assert.strictEqual(harness.children.length, 1);
    const material = (harness.children[0].children[0] as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    assert.strictEqual(
      `#${material.color.getHexString()}`,
      peerColor("client-a", { peerId: "a" })
    );
  });

  test("reuses the same mesh across presence updates", () => {
    const harness = createHarness();
    harness.setPeer("client-a", { brush: kCursor });

    harness.emit("sync");
    const [mesh] = harness.children;
    harness.emit("peer-presence", {
      clientId: "client-a",
      patch: { brush: { ...kCursor, size: 3 } }
    });

    assert.deepStrictEqual(harness.children, [mesh]);
  });

  test("ignores a presence patch that carries no brush", () => {
    const harness = createHarness();
    harness.setPeer("client-a", { brush: kCursor });

    harness.emit("peer-presence", {
      clientId: "client-a",
      patch: { camera: {} }
    });

    assert.deepStrictEqual(harness.children, []);
  });

  test("hides the mesh of a peer aiming at nothing", () => {
    const harness = createHarness();
    harness.setPeer("client-a", { brush: null });

    harness.emit("sync");

    assert.strictEqual(harness.children[0].visible, true);
    assert.ok(
      harness.children[0].children.every((child) => child.visible === false)
    );
  });

  test("detaches the mesh of a peer that left", () => {
    const harness = createHarness();
    harness.setPeer("client-a", { brush: kCursor });
    harness.emit("sync");

    harness.removePeer("client-a");
    harness.emit("peer-left", { clientId: "client-a" });

    assert.deepStrictEqual(harness.children, []);
  });

  test("drops the mesh of a peer missing from a later sync", () => {
    const harness = createHarness();
    harness.setPeer("client-a", { brush: kCursor });
    harness.emit("sync");

    harness.removePeer("client-a");
    harness.emit("sync");

    assert.deepStrictEqual(harness.children, []);
  });

  test("detaches every mesh and unsubscribes on destroy", () => {
    const harness = createHarness();
    harness.setPeer("client-a", { brush: kCursor });
    harness.setPeer("client-b", { brush: kCursor });
    harness.emit("sync");

    harness.peers.destroy();

    assert.deepStrictEqual(harness.children, []);
    assert.strictEqual(harness.listenerCount("sync"), 0);
    assert.strictEqual(harness.listenerCount("peer-left"), 0);
    assert.strictEqual(harness.listenerCount("peer-presence"), 0);
  });
});

describe("PeerBrushes / local priority", () => {
  test("hides a peer brush covering the local cursor cells", () => {
    const harness = createHarness();
    harness.setPeer("client-a", { brush: kCursor });
    harness.emit("sync");

    harness.peers.publishLocalCursor({ ...kCursor });

    assert.ok(
      harness.children[0].children.every((child) => child.visible === false)
    );
  });

  test("shows it again once the local cursor moves off", () => {
    const harness = createHarness();
    harness.setPeer("client-a", { brush: kCursor });
    harness.emit("sync");

    harness.peers.publishLocalCursor({ ...kCursor });
    harness.peers.publishLocalCursor({
      ...kCursor,
      position: { x: 20, y: 2, z: 3 }
    });

    assert.ok(
      harness.children[0].children.every((child) => child.visible === true)
    );
  });

  test("keeps a peer brush aimed elsewhere visible", () => {
    const harness = createHarness();
    harness.setPeer("client-a", { brush: kCursor });
    harness.emit("sync");

    harness.peers.publishLocalCursor({
      position: { x: 40, y: 2, z: 3 },
      size: 1
    });

    assert.ok(
      harness.children[0].children.every((child) => child.visible === true)
    );
  });

  test("hides a peer that moves onto the local cursor", () => {
    const harness = createHarness();
    harness.setPeer("client-a", { brush: null });
    harness.emit("sync");
    harness.peers.publishLocalCursor({ ...kCursor });

    harness.emit("peer-presence", {
      clientId: "client-a",
      patch: { brush: kCursor }
    });

    assert.ok(
      harness.children[0].children.every((child) => child.visible === false)
    );
  });
});
