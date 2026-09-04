// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// CONSTANTS
// The extra 0.01 prevents z-fighting with the chunk mesh.
const kHalfSize = 0.51;
const kDefaultHighlight = 0x9df6ff;

export interface BrushMeshOptions {
  /**
   * Color of the brush preview cubes. It also tints the outline unless that
   * is set on its own.
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
   * @default `color` when it is given, 0x9df6ff otherwise
   */
  borderColor?: THREE.ColorRepresentation;
  /**
   * Outline width in CSS pixels.
   * @default 2
   */
  borderLineWidth?: number;
}

/**
 * Draws the cells a brush covers, as translucent cubes wrapped in one outline.
 *
 * Visibility has a single owner: `hide()` and `show()` set the intent, and
 * nothing is drawn while the cell count is zero.
 */
export class BrushMesh extends THREE.Group {
  static maxCells = 512;

  #previewMesh: THREE.InstancedMesh;
  #dummy = new THREE.Object3D();

  #border: LineSegments2;

  #hidden = false;
  #cellCount = 0;

  constructor(
    options: BrushMeshOptions = {}
  ) {
    super();

    const {
      color = 0x33e0ff,
      opacity = 0.15,
      borderLineWidth = 2
    } = options;
    const highlight = options.color ?? kDefaultHighlight;
    const borderColor = options.borderColor ?? highlight;

    this.name = "brush";

    const inflatedSize = kHalfSize * 2;
    const geometry = new THREE.BoxGeometry(
      inflatedSize,
      inflatedSize,
      inflatedSize
    );
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false
    });

    this.#previewMesh = new THREE.InstancedMesh(
      geometry,
      material,
      BrushMesh.maxCells
    );
    this.#previewMesh.count = 0;
    this.#previewMesh.renderOrder = 1;
    this.#previewMesh.frustumCulled = false;
    this.#previewMesh.visible = false;

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

    this.add(
      this.#previewMesh,
      this.#border
    );
  }

  hide(): void {
    this.#hidden = true;
    this.#applyVisibility();
  }

  show(): void {
    this.#hidden = false;
    this.#applyVisibility();
  }

  clearCells(): void {
    this.#cellCount = 0;
    this.#previewMesh.count = 0;
    this.#applyVisibility();
  }

  drawCells(
    cells: VoxelCoord[]
  ): void {
    const count = Math.min(cells.length, BrushMesh.maxCells);

    for (let i = 0; i < count; i++) {
      this.#dummy.position.set(
        cells[i].x + 0.5,
        cells[i].y + 0.5,
        cells[i].z + 0.5
      );
      this.#dummy.quaternion.identity();
      this.#dummy.updateMatrix();
      this.#previewMesh.setMatrixAt(i, this.#dummy.matrix);
    }

    this.#previewMesh.count = count;
    this.#previewMesh.instanceMatrix.needsUpdate = true;
    this.#cellCount = count;

    if (count === 0) {
      this.clearCells();

      return;
    }

    this.#border.geometry.setPositions(
      this.#buildBorderPositions(cells, count)
    );
    this.#applyVisibility();
  }

  #applyVisibility(): void {
    const visible = !this.#hidden && this.#cellCount > 0;

    this.#previewMesh.visible = visible;
    this.#border.visible = visible;
  }

  #buildBorderPositions(
    cells: VoxelCoord[],
    count: number
  ): number[] {
    const result: number[] = [];

    for (let i = 0; i < count; i++) {
      const x = cells[i].x + 0.5 - kHalfSize;
      const y = cells[i].y + 0.5 - kHalfSize;
      const z = cells[i].z + 0.5 - kHalfSize;
      const size = kHalfSize * 2;

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

      result.push(b0x, b0y, b0z, b1x, b1y, b1z);
      result.push(b1x, b1y, b1z, b2x, b2y, b2z);
      result.push(b2x, b2y, b2z, b3x, b3y, b3z);
      result.push(b3x, b3y, b3z, b0x, b0y, b0z);
      result.push(t0x, t0y, t0z, t1x, t1y, t1z);
      result.push(t1x, t1y, t1z, t2x, t2y, t2z);
      result.push(t2x, t2y, t2z, t3x, t3y, t3z);
      result.push(t3x, t3y, t3z, t0x, t0y, t0z);
      result.push(b0x, b0y, b0z, t0x, t0y, t0z);
      result.push(b1x, b1y, b1z, t1x, t1y, t1z);
      result.push(b2x, b2y, b2z, t2x, t2y, t2z);
      result.push(b3x, b3y, b3z, t3x, t3y, t3z);
    }

    return result;
  }
}
