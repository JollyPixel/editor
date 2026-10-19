// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { PeerHighlights } from "./PeerHighlights.ts";
import type { MeshHighlightState } from "../MeshHighlightState.ts";

export interface PeerVisibilityOptions {
  peers: PeerHighlights;
  state: MeshHighlightState;
  camera: THREE.Camera;
  /**
   * Maximum camera-to-surface distance in world units.
   * @default Infinity
   */
  maxDistance?: number;
}

export class PeerVisibility extends EventTarget {
  #peers: PeerHighlights;
  #state: MeshHighlightState;
  #camera: THREE.Camera;
  #maxDistance: number;

  #visible = new Map<string, boolean>();

  #frustum = new THREE.Frustum();
  #viewProjectionMatrix = new THREE.Matrix4();
  #cameraPosition = new THREE.Vector3();
  #box = new THREE.Box3();
  #sphere = new THREE.Sphere();

  constructor(
    options: PeerVisibilityOptions
  ) {
    super();

    this.#peers = options.peers;
    this.#state = options.state;
    this.#camera = options.camera;
    this.#maxDistance = options.maxDistance ?? Infinity;
  }

  get camera(): THREE.Camera {
    return this.#camera;
  }

  set camera(
    camera: THREE.Camera
  ) {
    this.#camera = camera;
  }

  get maxDistance(): number {
    return this.#maxDistance;
  }

  set maxDistance(
    maxDistance: number
  ) {
    this.#maxDistance = maxDistance;
  }

  update(): void {
    this.#camera.updateMatrixWorld();
    this.#viewProjectionMatrix.multiplyMatrices(
      this.#camera.projectionMatrix,
      this.#camera.matrixWorldInverse
    );
    this.#frustum.setFromProjectionMatrix(this.#viewProjectionMatrix);
    this.#camera.getWorldPosition(this.#cameraPosition);

    const currentIds = new Set([
      ...this.#peers.selectedObjectIds(),
      ...this.#peers.hoveredObjectIds()
    ]);
    let changed = false;

    for (const id of this.#visible.keys()) {
      if (!currentIds.has(id)) {
        this.#visible.delete(id);
      }
    }

    for (const id of currentIds) {
      const target = this.#state.findTarget(id);
      if (!target) {
        continue;
      }

      this.#box.setFromObject(target);
      if (this.#box.isEmpty()) {
        continue;
      }
      this.#box.getBoundingSphere(this.#sphere);

      const inFrustum = this.#frustum.intersectsSphere(this.#sphere);
      const withinDistance = !Number.isFinite(this.#maxDistance) ||
        this.#sphere.center.distanceTo(this.#cameraPosition) - this.#sphere.radius <= this.#maxDistance;
      const visible = inFrustum && withinDistance;

      if (this.#visible.get(id) !== visible) {
        changed = true;
      }
      this.#visible.set(id, visible);
    }

    if (changed) {
      this.dispatchEvent(new Event("visibilityChange"));
    }
  }

  isVisible(
    objectId: string
  ): boolean {
    return this.#visible.get(objectId) ?? true;
  }

  dispose(): void {
    this.#visible.clear();
  }
}
