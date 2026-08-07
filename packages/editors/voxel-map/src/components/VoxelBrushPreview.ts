// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// CONSTANTS
// Half-extent of a preview cube, slightly larger than a voxel (0.5) to avoid
// z-fighting against the actual chunk mesh at the edge of the hit.
const kHalfSize = 0.51;
const kFaceMargin = 0.05;
const kFaceOffset = 0.001;
const kFaceDefaultNormal = new THREE.Vector3(0, 0, 1);

export interface VoxelBrushPreviewOptions {
  /**
   * Color of the brush preview cubes.
   * @default 0x33e0ff
   */
  color?: THREE.ColorRepresentation;
  /**
   * Opacity of the brush preview cubes.
   * @default 0.15
   */
  opacity?: number;
  /**
   * Color of the outline drawn around each preview cube.
   * @default 0x9df6ff
   */
  borderColor?: THREE.ColorRepresentation;
  /**
   * Outline width in CSS pixels.
   * @default 2
   */
  borderLineWidth?: number;
  /**
   * Color of the highlighted quad drawn on the hit face.
   * @default 0x9df6ff
   */
  faceColor?: THREE.ColorRepresentation;
  /**
   * Opacity of the highlighted hit face.
   * @default 0.45
   */
  faceOpacity?: number;
}

/**
 * Renders a ghost-preview of the brush footprint using an InstancedMesh,
 * a `LineSegments2` outline, and a highlighted quad on the hit face.
 *
 * Uses WebGPU line helpers (`LineSegments2`/`Line2NodeMaterial`) rather than
 * core `THREE.LineSegments`/`LineDashedMaterial` — `Line2NodeMaterial` is
 * node-based (no `onBeforeCompile` GLSL patching), so it works with
 * WebGPURenderer's NodeBuilder while keeping a stable pixel line width.
 * Mirrors voxel-renderer's `examples/scripts/utils/brushHighlight.ts`.
 */
export class VoxelBrushPreview extends ActorComponent {
  static Max = 512;

  #previewMesh: THREE.InstancedMesh;
  #dummy = new THREE.Object3D();

  #border: LineSegments2;

  #faceMesh: THREE.InstancedMesh;
  #faceQuaternion = new THREE.Quaternion();

  constructor(
    actor: Actor,
    options: VoxelBrushPreviewOptions = {}
  ) {
    super({
      actor,
      typeName: "VoxelBrushPreview"
    });

    const {
      color = 0x33e0ff,
      opacity = 0.15,
      borderColor = 0x9df6ff,
      borderLineWidth = 2,
      faceColor = 0x9df6ff,
      faceOpacity = 0.45
    } = options;

    const inflatedSize = kHalfSize * 2;
    const geometry = new THREE.BoxGeometry(inflatedSize, inflatedSize, inflatedSize);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false
    });

    this.#previewMesh = new THREE.InstancedMesh(
      geometry,
      material,
      VoxelBrushPreview.Max
    );
    this.#previewMesh.count = 0;
    this.#previewMesh.renderOrder = 1;
    this.#previewMesh.frustumCulled = false;

    const borderGeometry = new LineSegmentsGeometry();
    borderGeometry.setPositions([]);
    const borderMaterial = new Line2NodeMaterial({
      color: borderColor,
      linewidth: borderLineWidth,
      depthTest: false
    });
    this.#border = new LineSegments2(borderGeometry, borderMaterial);
    this.#border.renderOrder = 2;
    this.#border.frustumCulled = false;
    this.#border.visible = false;

    const faceGeometry = new THREE.PlaneGeometry(1 - kFaceMargin * 2, 1 - kFaceMargin * 2);
    const faceMaterial = new THREE.MeshBasicMaterial({
      color: faceColor,
      opacity: faceOpacity,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.#faceMesh = new THREE.InstancedMesh(
      faceGeometry,
      faceMaterial,
      VoxelBrushPreview.Max
    );
    this.#faceMesh.count = 0;
    this.#faceMesh.renderOrder = 3;
    this.#faceMesh.frustumCulled = false;
    this.#faceMesh.visible = false;
  }

  awake() {
    this.actor.addChildren(this.#previewMesh);
    this.actor.addChildren(this.#border);
    this.actor.addChildren(this.#faceMesh);
  }

  override destroy(): void {
    this.#previewMesh.geometry.dispose();
    (this.#previewMesh.material as THREE.Material).dispose();
    this.#border.geometry.dispose();
    (this.#border.material as THREE.Material).dispose();
    this.#faceMesh.geometry.dispose();
    (this.#faceMesh.material as THREE.Material).dispose();
    super.destroy();
  }

  set count(value: number) {
    this.#previewMesh.count = value;
    this.#border.visible = value > 0;
    if (value === 0) {
      this.#faceMesh.visible = false;
    }
  }

  hide(): void {
    this.#previewMesh.visible = false;
    this.#border.visible = false;
    this.#faceMesh.visible = false;
  }

  show(): void {
    this.#previewMesh.visible = true;
    this.#border.visible = true;
    this.#faceMesh.visible = true;
  }

  /**
   * @param normal Hit face normal, in world space. Highlights the
   * corresponding face of every preview cube; pass `null` to hide it.
   */
  updateFromPositions(
    positions: THREE.Vector3[],
    normal: THREE.Vector3 | null = null
  ) {
    this.#previewMesh.visible = true;
    const count = Math.min(positions.length, VoxelBrushPreview.Max);

    for (let i = 0; i < count; i++) {
      this.#dummy.position.set(
        positions[i].x + 0.5,
        positions[i].y + 0.5,
        positions[i].z + 0.5
      );
      this.#dummy.quaternion.identity();
      this.#dummy.updateMatrix();
      this.#previewMesh.setMatrixAt(i, this.#dummy.matrix);
    }

    this.#previewMesh.count = count;
    this.#previewMesh.instanceMatrix.needsUpdate = true;

    if (count === 0) {
      this.#border.visible = false;
      this.#faceMesh.visible = false;

      return;
    }

    this.#border.geometry.setPositions(this.#buildBorderPositions(positions, count));
    this.#border.visible = true;

    this.#updateFace(positions, count, normal);
  }

  /**
   * Places a highlighted quad on the given face (`normal`) of every
   * preview cube, offset outward by `kHalfSize` to sit flush on the surface.
   */
  #updateFace(
    positions: THREE.Vector3[],
    count: number,
    normal: THREE.Vector3 | null
  ): void {
    if (normal === null) {
      this.#faceMesh.visible = false;

      return;
    }

    this.#faceQuaternion.setFromUnitVectors(kFaceDefaultNormal, normal);
    const offset = kHalfSize + kFaceOffset;

    for (let i = 0; i < count; i++) {
      this.#dummy.position.set(
        positions[i].x + 0.5 + normal.x * offset,
        positions[i].y + 0.5 + normal.y * offset,
        positions[i].z + 0.5 + normal.z * offset
      );
      this.#dummy.quaternion.copy(this.#faceQuaternion);
      this.#dummy.updateMatrix();
      this.#faceMesh.setMatrixAt(i, this.#dummy.matrix);
    }

    this.#faceMesh.count = count;
    this.#faceMesh.instanceMatrix.needsUpdate = true;
    this.#faceMesh.visible = true;
  }

  /**
   * Returns a flat positions array (start/end pairs) for the 12 edges
   * of each preview cube, suitable for `LineSegmentsGeometry.setPositions()`.
   */
  #buildBorderPositions(
    positions: THREE.Vector3[],
    count: number
  ): number[] {
    const result: number[] = [];

    for (let i = 0; i < count; i++) {
      const x = positions[i].x + 0.5 - kHalfSize;
      const y = positions[i].y + 0.5 - kHalfSize;
      const z = positions[i].z + 0.5 - kHalfSize;
      const size = kHalfSize * 2;

      // Bottom-face corners (y)
      const b0x = x;
      const b0y = y;
      const b0z = z;
      const b1x = x + size;
      const b1y = y;
      const b1z = z;
      const b2x = x + size;
      const b2y = y;
      const b2z = z + size;
      const b3x = x;
      const b3y = y;
      const b3z = z + size;

      // Top-face corners (y+size)
      const t0x = x;
      const t0y = y + size;
      const t0z = z;
      const t1x = x + size;
      const t1y = y + size;
      const t1z = z;
      const t2x = x + size;
      const t2y = y + size;
      const t2z = z + size;
      const t3x = x;
      const t3y = y + size;
      const t3z = z + size;

      // Bottom 4 edges
      result.push(b0x, b0y, b0z, b1x, b1y, b1z);
      result.push(b1x, b1y, b1z, b2x, b2y, b2z);
      result.push(b2x, b2y, b2z, b3x, b3y, b3z);
      result.push(b3x, b3y, b3z, b0x, b0y, b0z);
      // Top 4 edges
      result.push(t0x, t0y, t0z, t1x, t1y, t1z);
      result.push(t1x, t1y, t1z, t2x, t2y, t2z);
      result.push(t2x, t2y, t2z, t3x, t3y, t3z);
      result.push(t3x, t3y, t3z, t0x, t0y, t0z);
      // 4 vertical edges
      result.push(b0x, b0y, b0z, t0x, t0y, t0z);
      result.push(b1x, b1y, b1z, t1x, t1y, t1z);
      result.push(b2x, b2y, b2z, t2x, t2y, t2z);
      result.push(b3x, b3y, b3z, t3x, t3y, t3z);
    }

    return result;
  }
}
