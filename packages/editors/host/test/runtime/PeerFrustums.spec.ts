// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  ActorComponents,
  Systems,
  type Actor
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { PeerFrustums } from "#src/runtime/PeerFrustums.ts";
import { FakeRoom } from "../helpers/rooms.ts";

interface FrustumsHarness {
  room: FakeRoom;
  frustums: PeerFrustums;
  invalidations(): number;
}

function createFrustums(): FrustumsHarness {
  const room = new FakeRoom("voxel-map:test");
  let invalidations = 0;

  const actor = {
    components: new ActorComponents(),
    world: {
      invalidate: () => {
        invalidations++;
      },
      sceneManager: {
        actors: new Systems.ActorRegistry(new THREE.Scene()),
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
    invalidations: () => invalidations
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
  test("wakes the world when a peer joins", () => {
    const { room, invalidations } = createFrustums();
    const before = invalidations();

    joinPeer(room, "peer-a");

    assert.equal(invalidations(), before + 1);
  });

  test("releases its listeners once destroyed", () => {
    const { room, frustums, invalidations } = createFrustums();
    frustums.destroy();
    const before = invalidations();

    joinPeer(room, "peer-a");

    assert.equal(invalidations(), before);
  });
});
