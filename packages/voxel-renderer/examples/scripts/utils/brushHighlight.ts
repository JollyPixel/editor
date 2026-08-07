// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import type {
  VoxelCoord
} from "../../../src/world/types.ts";

// CONSTANTS
const kDefaultLineWidth = 3;
const kDefaultFillOpacity = 0.2;
const kFaceOpacity = 0.45;

// Slightly larger than a voxel to avoid z-fighting.
const kHalfSize = 0.51;
const kEdgesGeometry = new LineSegmentsGeometry();
kEdgesGeometry.setPositions(buildBoxEdgePositions(kHalfSize));
const kFillGeometry = new THREE.BoxGeometry(1.02, 1.02, 1.02);
// Face quad, reoriented per hit face at runtime.
const kFaceGeometry = new THREE.PlaneGeometry(0.9, 0.9);
const kFaceDefaultNormal = new THREE.Vector3(0, 0, 1);

export interface HighlightBoxOptions {
  /**
   * Adds a translucent body inside the outline.
   * @default false
   */
  fill?: boolean;
  /**
   * Outline width in CSS pixels.
   * @default 3
   */
  lineWidth?: number;
}

/**
 * Wireframe voxel highlight with optional fill.
 * Uses WebGPU line helpers so outline width stays stable in CSS pixels.
 */
export class HighlightBox extends THREE.Group {
  #border: LineSegments2;
  #face: THREE.Mesh;

  constructor(
    color: THREE.ColorRepresentation,
    options: HighlightBoxOptions = {}
  ) {
    super();

    const { fill = false, lineWidth = kDefaultLineWidth } = options;

    this.name = "brush_highlight";
    this.visible = false;

    const borderMaterial = new Line2NodeMaterial({
      color,
      linewidth: lineWidth,
      depthTest: false
    });
    this.#border = new LineSegments2(kEdgesGeometry, borderMaterial);
    this.#border.frustumCulled = false;
    // Draw after chunk meshes; child renderOrder is not inherited from the group.
    this.#border.renderOrder = 1;
    this.add(this.#border);

    if (fill) {
      const fillMesh = new THREE.Mesh(
        kFillGeometry,
        new THREE.MeshBasicMaterial({
          color,
          opacity: kDefaultFillOpacity,
          transparent: true,
          depthWrite: false
        })
      );
      fillMesh.renderOrder = 1;
      this.add(fillMesh);
    }

    // Marks the hit face.
    this.#face = new THREE.Mesh(
      kFaceGeometry,
      new THREE.MeshBasicMaterial({
        color,
        opacity: kFaceOpacity,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    this.#face.visible = false;
    this.#face.renderOrder = 2;
    this.add(this.#face);
  }

  /**
    * Shows the hit face, or hides it when `normal` is `null`.
   */
  setFace(
    normal: THREE.Vector3 | null
  ): void {
    if (normal === null) {
      this.#face.visible = false;

      return;
    }

    this.#face.position.copy(normal).multiplyScalar(kHalfSize + 0.001);
    this.#face.quaternion.setFromUnitVectors(kFaceDefaultNormal, normal);
    this.#face.visible = true;
  }
}

export function createHighlightBox(
  color: THREE.ColorRepresentation,
  options: HighlightBoxOptions = {}
): HighlightBox {
  return new HighlightBox(color, options);
}

export function moveHighlight(
  highlight: THREE.Object3D,
  position: VoxelCoord | null
): void {
  if (position === null) {
    highlight.visible = false;

    return;
  }

  highlight.position.set(
    position.x + 0.5,
    position.y + 0.5,
    position.z + 0.5
  );
  highlight.visible = true;
}

/**
 * Returns centered box edges for `LineSegmentsGeometry.setPositions()`.
 */
function buildBoxEdgePositions(half: number): number[] {
  const corners: [number, number, number][] = [
    [-half, -half, -half],
    [half, -half, -half],
    [half, -half, half],
    [-half, -half, half],
    [-half, half, -half],
    [half, half, -half],
    [half, half, half],
    [-half, half, half]
  ];

  const edges: [number, number][] = [
    // Bottom face
    [0, 1], [1, 2], [2, 3], [3, 0],
    // Top face
    [4, 5], [5, 6], [6, 7], [7, 4],
    // Verticals
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  return edges.flatMap(([a, b]) => [...corners[a], ...corners[b]]);
}
