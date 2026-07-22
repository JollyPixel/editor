// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import type { UVRegion } from "../../../src/uv/UVRegion.ts";
import type { SelectionRect, Vec2 } from "../../../src/types.ts";

export interface CubeBehaviorOptions {
  canvasTexture: THREE.CanvasTexture;
  region: UVRegion;
  textureSize: Vec2;
}

/**
 * A rotating test cube mapped to one UV region, so region placement/move
 * can be visually verified. Face assignment is out of scope for this
 * version: the region's rect is applied uniformly to all 6 faces.
 */
// CONSTANTS
const kCubeSize = 1.5;
const kHighlightScale = 1.06;
// Both in rad/sec.
const kRotationSpeedX = 0.3;
const kRotationSpeedY = 0.6;
// Higher = snaps into position faster. Frame-rate independent (see update()).
const kPositionLerpRate = 6;

export class CubeBehavior extends ActorComponent {
  mesh: THREE.Mesh;
  canvasTexture: THREE.CanvasTexture;
  readonly regionId: string;

  #highlightMesh: THREE.Mesh;
  /**
   * Snapshot of BoxGeometry's pristine per-vertex UV (every component
   * exactly 0 or 1), captured once before the first remap. Every later
   * remap (e.g. after a move) derives corner identity from this snapshot,
   * never from the geometry's current (already-remapped) UV attribute —
   * which no longer contains exact 0/1 values after the first call.
   */
  #baseUV: Float32Array;
  /**
   * Where the actor eases toward each frame (see `setTargetPosition`),
   * instead of snapping — set by the demo's grid layout in main.ts.
   */
  #targetPosition: THREE.Vector3;

  constructor(
    actor: Actor,
    options: CubeBehaviorOptions
  ) {
    super({
      actor,
      typeName: "CubeBehavior"
    });

    const { canvasTexture, region, textureSize } = options;

    this.regionId = region.id;
    this.canvasTexture = canvasTexture;

    const geometry = new THREE.BoxGeometry(
      kCubeSize,
      kCubeSize,
      kCubeSize
    );
    this.#baseUV = Float32Array.from(
      geometry.attributes.uv.array
    );

    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        map: canvasTexture,
        transparent: true
      })
    );
    this.mesh.userData.regionId = region.id;
    this.#applyRegionUV(region.rect, textureSize);

    // Backface-rendered, slightly larger shell: a cheap, always-visible
    // "selected" outline that doesn't depend on the (possibly bright/white)
    // texture for contrast, unlike an emissive tint would. Uses the
    // region's own color (same one driving its 2D SVG overlay border), so
    // a cube visually matches the region it maps — same reasoning as
    // UVOverlay in the library itself.
    const highlightSize = kCubeSize * kHighlightScale;
    this.#highlightMesh = new THREE.Mesh(
      new THREE.BoxGeometry(highlightSize, highlightSize, highlightSize),
      new THREE.MeshBasicMaterial({
        color: region.color,
        side: THREE.BackSide
      })
    );
    this.#highlightMesh.visible = false;

    this.actor.addChildren(this.mesh, this.#highlightMesh);
    this.#targetPosition = this.actor.object3D.position.clone();
  }

  /**
   * Eases the actor toward `position` over the next few frames instead of
   * snapping, so the demo's grid re-centering (main.ts) reads as a smooth
   * reflow rather than a jump cut.
   */
  setTargetPosition(
    position: THREE.Vector3
  ): void {
    this.#targetPosition.copy(position);
  }

  /**
   * Updates the mapped rect, either the region's committed position (on
   * "region-moved") or a live drag preview (on "region-dragging") — both
   * are a plain rect, so the same path drives live and committed updates.
   */
  updateRect(
    rect: SelectionRect,
    textureSize: Vec2
  ): void {
    this.#applyRegionUV(rect, textureSize);
  }

  setSelected(
    selected: boolean
  ): void {
    this.#highlightMesh.visible = selected;
  }

  update(
    deltaTime: number
  ): void {
    // Rotate the actor itself (not the mesh directly) so the highlight
    // shell, a sibling under the same actor, spins in lockstep.
    this.actor.object3D.rotation.x += kRotationSpeedX * deltaTime;
    this.actor.object3D.rotation.y += kRotationSpeedY * deltaTime;

    // Exponential ease toward the target — frame-rate independent, unlike
    // a flat `lerp(target, constant)` would be.
    const alpha = 1 - Math.exp(-kPositionLerpRate * deltaTime);
    this.actor.object3D.position.lerp(this.#targetPosition, alpha);

    this.canvasTexture.needsUpdate = true;
  }

  /**
   * Remaps BoxGeometry's default per-face 0..1 UV unwrap onto the given
   * rect (normalized against `textureSize`), using `#baseUV` (the pristine
   * snapshot) to identify each vertex's corner — never the geometry's
   * current UV attribute, which no longer holds exact 0/1 values after the
   * first remap. Works regardless of vertex order this way, repeatably. V
   * is flipped (canvas Y grows downward, texture V grows upward for a
   * default-flipY CanvasTexture).
   */
  #applyRegionUV(
    rect: SelectionRect,
    textureSize: Vec2
  ): void {
    const uvAttr = this.mesh.geometry.attributes.uv;
    const u0 = rect.x / textureSize.x;
    const u1 = (rect.x + rect.width) / textureSize.x;
    const v0 = 1 - ((rect.y + rect.height) / textureSize.y);
    const v1 = 1 - (rect.y / textureSize.y);

    for (let i = 0; i < uvAttr.count; i++) {
      const u = this.#baseUV[i * 2];
      const v = this.#baseUV[(i * 2) + 1];
      uvAttr.setXY(i, u === 0 ? u0 : u1, v === 0 ? v0 : v1);
    }
    uvAttr.needsUpdate = true;
  }
}
