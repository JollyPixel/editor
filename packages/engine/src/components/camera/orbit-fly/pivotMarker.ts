// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { disposeObject3D } from "../../../utils/disposeObject3D.ts";

// CONSTANTS
const kPivotMarkerColor = 0x999999;
const kPivotMarkerSize = 0.2;
const kPivotMarkerRenderOrder = 999;

export interface PivotMarkerOptions {
  enabled: boolean;
  sceneProvider: () => THREE.Object3D;
}

export class PivotMarker {
  #enabled: boolean;
  #sceneProvider: () => THREE.Object3D;
  #object: THREE.Object3D | null = null;

  constructor(
    options: PivotMarkerOptions
  ) {
    this.#enabled = options.enabled;
    this.#sceneProvider = options.sceneProvider;
  }

  show(): void {
    if (!this.#enabled) {
      return;
    }

    if (this.#object === null) {
      this.#object = createPivotMarkerObject();
      this.#sceneProvider().add(this.#object);
    }
    this.#object.visible = true;
  }

  hide(): void {
    if (this.#object) {
      this.#object.visible = false;
    }
  }

  moveTo(
    position: THREE.Vector3Like
  ): void {
    this.#object?.position.copy(position);
  }

  dispose(): void {
    if (this.#object) {
      disposeObject3D(this.#object);
      this.#object = null;
    }
  }
}

function createPivotMarkerObject(): THREE.Object3D {
  const halfSize = kPivotMarkerSize;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfSize, 0, 0), new THREE.Vector3(halfSize, 0, 0),
    new THREE.Vector3(0, -halfSize, 0), new THREE.Vector3(0, halfSize, 0),
    new THREE.Vector3(0, 0, -halfSize), new THREE.Vector3(0, 0, halfSize)
  ]);
  const material = new THREE.LineBasicMaterial({
    color: kPivotMarkerColor,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    toneMapped: false
  });
  const marker = new THREE.LineSegments(geometry, material);
  marker.renderOrder = kPivotMarkerRenderOrder;
  marker.frustumCulled = false;
  marker.visible = false;

  return marker;
}
