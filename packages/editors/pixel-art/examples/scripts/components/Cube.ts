// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";
import type {
  UVFace,
  UVRegion,
  SelectionRect,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

export interface CubeBehaviorOptions {
  canvasTexture: THREE.CanvasTexture;
  region: UVRegion;
  textureSize: Vec2;
}

/**
 * Rotating test cube mapped to one UV region (one rect per face when uncollapsed).
 */
// CONSTANTS
const kCubeSize = 1.5;
/**
 * Maps face names to BoxGeometry vertex offsets (+X, -X, +Y, -Y, +Z, -Z order).
 */
const kFaceVertexOffset: Record<UVFace, number> = {
  right: 0,
  left: 4,
  top: 8,
  bottom: 12,
  front: 16,
  back: 20
};
const kVerticesPerFace = 4;
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
   * Pristine BoxGeometry UVs (0 or 1 per component). Remaps always derive
   * corner identity from this snapshot, never from the live (remapped) attribute.
   */
  #baseUV: Float32Array;
  /**
   * Easing target for `#relayout` grid placement.
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
    this.applyRegion(region, textureSize);

    // Backface shell: cheap always-visible outline using the region's own color.
    const highlightSize = kCubeSize * kHighlightScale;
    this.#highlightMesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        highlightSize,
        highlightSize,
        highlightSize
      ),
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
   * Eases toward `position` over the next few frames (smooth grid reflow).
   */
  setTargetPosition(
    position: THREE.Vector3
  ): void {
    this.#targetPosition.copy(position);
  }

  /**
   * Remaps every face from the region's current state.
   */
  applyRegion(
    region: UVRegion,
    textureSize: Vec2
  ): void {
    for (const { face, rect } of region.facesOf()) {
      this.applyFace(face, rect, textureSize);
    }
  }

  /**
   * Remaps one face, or all faces when `face` is null (collapsed region).
   */
  applyFace(
    face: UVFace | null,
    rect: SelectionRect,
    textureSize: Vec2
  ): void {
    if (face === null) {
      this.#applyRectToRange(
        rect,
        textureSize,
        0,
        this.#baseUV.length / 2
      );
    }
    else {
      this.#applyRectToRange(
        rect,
        textureSize,
        kFaceVertexOffset[face],
        kVerticesPerFace
      );
    }

    this.mesh.geometry.attributes.uv.needsUpdate = true;
  }

  setSelected(
    selected: boolean
  ): void {
    this.#highlightMesh.visible = selected;
  }

  update(
    deltaTime: number
  ): void {
    // Rotate the actor so the highlight shell (sibling) spins in lockstep.
    this.actor.object3D.rotation.x += kRotationSpeedX * deltaTime;
    this.actor.object3D.rotation.y += kRotationSpeedY * deltaTime;

    // Frame-rate-independent exponential ease.
    const alpha = 1 - Math.exp(-kPositionLerpRate * deltaTime);
    this.actor.object3D.position.lerp(
      this.#targetPosition,
      alpha
    );

    this.canvasTexture.needsUpdate = true;
  }

  /**
   * Remaps BoxGeometry's 0..1 UVs onto the rect for `count` vertices from `start`.
   * Uses `#baseUV` for corner identity; V is flipped for CanvasTexture's flipY.
   */
  #applyRectToRange(
    rect: SelectionRect,
    textureSize: Vec2,
    start: number,
    count: number
  ): void {
    const uvAttr = this.mesh.geometry.attributes.uv;
    const u0 = rect.x / textureSize.x;
    const u1 = (rect.x + rect.width) / textureSize.x;
    const v0 = 1 - ((rect.y + rect.height) / textureSize.y);
    const v1 = 1 - (rect.y / textureSize.y);

    for (let i = start; i < start + count; i++) {
      const u = this.#baseUV[i * 2];
      const v = this.#baseUV[(i * 2) + 1];
      uvAttr.setXY(i, u === 0 ? u0 : u1, v === 0 ? v0 : v1);
    }
  }
}
