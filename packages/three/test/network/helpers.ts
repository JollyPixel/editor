// Import Third-party Dependencies
import * as THREE from "three";
import type { PeerMetadata } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { FakeRoom } from "../fixtures/room.ts";
import { PeerFrustum } from "#src/index.ts";
import {
  PeerFrustumSync,
  type PeerFrustumPose,
  type PeerFrustumSyncOptions
} from "#src/network/index.ts";

export type FrustumSetupOptions = Partial<
  Omit<PeerFrustumSyncOptions, "room" | "parent">
>;

export function pose(
  x: number,
  y = 0,
  z = 0
): PeerFrustumPose {
  return {
    position: { x, y, z },
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  };
}

export function setup(
  options: FrustumSetupOptions = {}
) {
  const room = new FakeRoom();
  const parent = new THREE.Object3D();
  const sync = new PeerFrustumSync({
    throttleMs: 0,
    ...options,
    room,
    parent
  });

  return { room, parent, sync };
}

export function joinPeer(
  room: FakeRoom,
  clientId: string,
  presence: PeerMetadata,
  profile: PeerMetadata = {}
): void {
  room.addPeer(clientId, { profile, presence });
  room.emitSync(clientId);
}

export function frustumsOf(
  parent: THREE.Object3D
): PeerFrustum[] {
  return parent.children.filter(
    (child): child is PeerFrustum => child instanceof PeerFrustum
  );
}
