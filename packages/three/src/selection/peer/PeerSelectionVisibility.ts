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
   * World-space distance (from the camera, minus the target's own bounding
   * radius) beyond which a peer-selected object is treated as not visible,
   * regardless of whether it's actually inside the frustum.
   * @default Infinity - no distance cutoff, frustum test only
   */
  maxDistance?: number;
  /**
   * Unions `hoverRegistry.hoveredObjectIds()` into the ids `update()`
   * evaluates, alongside `registry.selectedObjectIds()` - so a
   * peer-hovered-only object also gets frustum/distance culling. Omitting
   * this preserves selection-only behavior.
   */
  hoverRegistry?: PeerHoverRegistry;
}

/**
 * Tracks, per currently peer-selected object, whether it's worth rendering
 * a peer indicator for - inside the camera frustum and within
 * `maxDistance`. `PeerSelectionOverlays`/`PeerHighlightPass` accept this as
 * an optional `visibility` option and treat "not visible" the same as "not
 * selected", so a scene with many peer selections only pays overlay cost
 * for the ones actually worth showing.
 *
 * Never consulted for the local user's own selection/hover - only
 * `registry`'s peer selections. Hiding what the local user just clicked
 * because they panned away from it would read as a bug, not an
 * optimization.
 *
 * Must be tick-driven, not event-driven - camera motion is independent of
 * any selection-change event (same reasoning as
 * `PeerFrustumSync.update()`). Call `update()` once per render tick.
 * Dispatches `visibilityChange` only when a call actually flips at least
 * one id, so subscribers can listen once in their constructor and stay in
 * sync without being driven by hand.
 */
export class PeerSelectionVisibility extends EventTarget {
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #camera: THREE.Camera;
  #maxDistance: number;
  #hoverRegistry: PeerHoverRegistry | null;

  #visible = new Map<string, boolean>();

  // Scratch instances reused across `update()` calls to avoid per-tick GC
  // churn - their *contents* are always recomputed fresh, never cached
  // across ticks, since a selected object (an orbiting peer selection, say)
  // can move.
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

  setCamera(
    camera: THREE.Camera
  ): void {
    this.#camera = camera;
  }

  setMaxDistance(
    maxDistance: number
  ): void {
    this.#maxDistance = maxDistance;
  }

  /**
   * Recomputes visibility for every currently peer-selected (and
   * peer-hovered, if `hoverRegistry` was given) object - cheap, O(that
   * count), not scene size. Dispatches `visibilityChange` only when at
   * least one id's visibility actually changed. An id no longer tracked is
   * dropped without counting as a change.
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
   * Whether `objectId` was found visible on the last `update()` call.
   * Defaults `true` for an id `update()` hasn't seen yet (fail open, so a
   * caller reading this before the first `update()` runs doesn't wrongly
   * suppress everything).
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
