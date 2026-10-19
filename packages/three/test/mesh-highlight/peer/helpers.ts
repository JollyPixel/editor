// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  PeerHighlights,
  type PeerColorAllocator
} from "#src/index.ts";
import { MeshHighlightState } from "#src/mesh-highlight/MeshHighlightState.ts";

export interface PeerScene {
  state: MeshHighlightState;
  peers: PeerHighlights;
  mesh: THREE.Mesh;
}

export interface StubColorAllocator extends PeerColorAllocator {
  released: string[];
}

export function createFrontCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  camera.updateMatrixWorld();

  return camera;
}

export function createBox(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
}

export function createPeerScene(): PeerScene {
  const state = new MeshHighlightState();
  const peers = new PeerHighlights();
  const mesh = createBox();
  state.register("mesh-1", mesh);

  return {
    state,
    peers,
    mesh
  };
}

export function createStubColorAllocator(): StubColorAllocator {
  const released: string[] = [];

  return {
    released,
    peerColor: (peerId) => `stub:${peerId}`,
    release: (peerId) => {
      released.push(peerId);
    }
  };
}
