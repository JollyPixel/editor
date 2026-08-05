// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

// Import Internal Dependencies
import type {
  VoxelCoord
} from "../../../src/world/types.ts";

// CONSTANTS
const kDefaultLineWidth = 3;
const kDefaultFillOpacity = 0.2;
const kFaceOpacity = 0.45;

// Slightly larger than a voxel so the outline never z-fights with the faces it wraps.
const kHalfSize = 0.51;
const kEdgesGeometry = new LineSegmentsGeometry();
kEdgesGeometry.setPositions(buildBoxEdgePositions(kHalfSize));
const kFillGeometry = new THREE.BoxGeometry(1.02, 1.02, 1.02);
// A quad matching the plane default normal (+Z), reoriented per-face at runtime.
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
 * A wireframe (+ optional fill) cube used to mark a voxel cell. The outline
 * is drawn with `LineSegments2` so its width is a stable CSS-pixel value
 * instead of a 1px native GL line, which renders inconsistently (and often
 * near-invisibly) across GPUs/drivers.
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

    const borderMaterial = new LineMaterial({
      color,
      linewidth: lineWidth,
      depthTest: false,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
    });
    this.#border = new LineSegments2(kEdgesGeometry, borderMaterial);
    this.#border.frustumCulled = false;
    // Drawn after the chunk meshes so the outline stays readable through them
    // (Group.renderOrder is not inherited by children, so this must be set here).
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

    // Marks the face the ray hit, so it's clear where a placed voxel will land.
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
   * Shows a subtle quad flush with the given face of the cell (in the box's
   * local space), or hides it when `normal` is `null`.
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

  /**
   * `LineMaterial` renders at a fixed CSS-pixel width via its `resolution`
   * uniform, so it must be kept in sync with the canvas size on resize.
   */
  setResolution(
    width: number,
    height: number
  ): void {
    this.#border.material.resolution.set(width, height);
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
 * Returns the 12 edges of a box centered on the origin, as start/end position
 * pairs suitable for `LineSegmentsGeometry.setPositions()`.
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
