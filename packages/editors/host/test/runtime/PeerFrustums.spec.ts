// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type { Actor } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { PeerFrustums } from "#src/runtime/PeerFrustums.ts";
import { FakeRoom } from "../helpers/rooms.ts";

interface FrustumsHarness {
  room: FakeRoom;
  frustums: PeerFrustums;
  keepAlives: Set<() => boolean>;
  invalidations(): number;
  animating(): boolean;
}

function createFrustums(): FrustumsHarness {
  const room = new FakeRoom("voxel-map:test");
  const keepAlives = new Set<() => boolean>();
  let invalidations = 0;

  const actor = {
    components: [],
    componentsRequiringUpdate: [],
    world: {
      invalidate: () => {
        invalidations++;
      },
      keepAlive: (predicate: () => boolean) => {
        keepAlives.add(predicate);

        return () => {
          keepAlives.delete(predicate);
        };
      },
      sceneManager: {
        scheduleStart: () => void 0,
        cancelStart: () => void 0,
        getSource: () => new THREE.Scene()
      }
    }
  } as unknown as Actor;
  const frustums = new PeerFrustums(actor, {
    room,
    camera: new THREE.PerspectiveCamera()
  });
  frustums.awake();

  return {
    room,
    frustums,
    keepAlives,
    invalidations: () => invalidations,
    animating: () => [...keepAlives].some((predicate) => predicate())
  };
}

function joinPeer(
  room: FakeRoom,
  clientId: string
): void {
  room.peers.set(clientId, {
    clientId,
    role: "editor",
    profile: {},
    presence: {}
  });
  room.emit("peer-joined", { clientId });
}

describe("PeerFrustums", () => {
  test("keeps the world rendering while other peers share the room", () => {
    const { room, animating } = createFrustums();
    assert.equal(animating(), false);

    joinPeer(room, "peer-a");
    assert.equal(animating(), true);

    room.peers.delete("peer-a");
    assert.equal(animating(), false);
  });

  test("wakes the world when a peer joins", () => {
    const { room, invalidations } = createFrustums();
    const before = invalidations();

    joinPeer(room, "peer-a");

    assert.equal(invalidations(), before + 1);
  });

  test("releases its keep-alive and listeners once destroyed", () => {
    const { room, frustums, keepAlives, invalidations } = createFrustums();
    frustums.destroy();
    const before = invalidations();

    joinPeer(room, "peer-a");

    assert.equal(keepAlives.size, 0);
    assert.equal(invalidations(), before);
  });
});
