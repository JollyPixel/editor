// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { PeerSelectionRegistry } from "./PeerSelectionRegistry.ts";
import type { PeerHoverRegistry } from "./PeerHoverRegistry.ts";
import type { SelectionManager } from "../SelectionManager.ts";

export interface PeerSelectionVisibilityOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  camera: THREE.Camera;
  /**
   * Maximum camera-to-surface distance in world units.
   * @default Infinity
   */
  maxDistance?: number;
  /**
   * Also evaluates peer-hovered objects when provided.
   */
  hoverRegistry?: PeerHoverRegistry;
}

/**
 * Tracks frustum and distance visibility for peer indicators.
 * Call `update()` once per render tick.
 */
export class PeerSelectionVisibility extends EventTarget {
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #camera: THREE.Camera;
  #maxDistance: number;
  #hoverRegistry: PeerHoverRegistry | null;

  #visible = new Map<string, boolean>();

  #frustum = new THREE.Frustum();
  #viewProjectionMatrix = new THREE.Matrix4();
  #cameraPosition = new THREE.Vector3();
  #box = new THREE.Box3();
  #sphere = new THREE.Sphere();

  constructor(
    options: PeerSelectionVisibilityOptions
  ) {
    super();

    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#camera = options.camera;
    this.#maxDistance = options.maxDistance ?? Infinity;
    this.#hoverRegistry = options.hoverRegistry ?? null;
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

  /**
   * Recomputes visibility and dispatches when a result changes.
   */
  update(): void {
    this.#camera.updateMatrixWorld();
    this.#viewProjectionMatrix.multiplyMatrices(
      this.#camera.projectionMatrix, this.#camera.matrixWorldInverse
    );
    this.#frustum.setFromProjectionMatrix(this.#viewProjectionMatrix);
    this.#camera.getWorldPosition(this.#cameraPosition);

    const currentIds = new Set(this.#registry.selectedObjectIds());
    if (this.#hoverRegistry) {
      for (const id of this.#hoverRegistry.hoveredObjectIds()) {
        currentIds.add(id);
      }
    }
    let changed = false;

    for (const id of this.#visible.keys()) {
      if (!currentIds.has(id)) {
        this.#visible.delete(id);
      }
    }

    for (const id of currentIds) {
      const target = this.#selection.targetFor(id);
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

  /**
   * Returns the last result, or `true` before the id is evaluated.
   */
  isVisible(
    objectId: string
  ): boolean {
    return this.#visible.get(objectId) ?? true;
  }

  dispose(): void {
    this.#visible.clear();
  }
}
