// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  MeshHighlightState,
  PeerSelectionRegistry,
  type PeerColorAllocator
} from "#src/index.ts";

export interface PeerScene {
  selection: MeshHighlightState;
  registry: PeerSelectionRegistry;
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
  const selection = new MeshHighlightState();
  const registry = new PeerSelectionRegistry();
  const mesh = createBox();
  selection.register("mesh-1", mesh);

  return {
    selection,
    registry,
    mesh
  };
}

export function createStubColorAllocator(): StubColorAllocator {
  const released: string[] = [];

  return {
    released,
    colorOf: (peerId) => `stub:${peerId}`,
    release: (peerId) => {
      released.push(peerId);
    }
  };
}
