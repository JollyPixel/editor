// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

export interface VoxelBrushOptions {
  /**
   * Color of the brush preview cubes.
   * @default 0x4488ff
   */
  color?: THREE.ColorRepresentation;
  /**
   * Opacity of the brush preview cubes.
   * @default 0.15
   */
  opacity?: number;
  /**
   * Color of the dotted border outline drawn around each preview cube.
   * @default 0x88ccff
   */
  borderColor?: THREE.ColorRepresentation;
  /**
   * Width of the border lines in CSS pixels.
   * @default 1.5
   */
  borderWidth?: number;
  /**
   * Dash length in world units.
   * @default 0.2
   */
  borderDashSize?: number;
  /**
   * Gap length between dashes in world units.
   * @default 0.12
   */
  borderGapSize?: number;
}

/**
 * Renders a ghost-preview of the brush footprint using InstancedMesh
 * plus a dotted LineSegments2 border outline around each preview cube.
 */
export class VoxelBrushPreview extends ActorComponent {
  static Max = 512;

  #color: THREE.ColorRepresentation;
  #opacity: number;
  #previewMesh: THREE.InstancedMesh;
  #dummy = new THREE.Object3D();

  #borderMesh: LineSegments2;

  constructor(
    actor: Actor,
    options: VoxelBrushOptions = {}
  ) {
    super({
      actor,
      typeName: "VoxelBrushPreview"
    });

    const {
      color = 0x4488ff,
      opacity = 0.15,
      borderColor = 0x88ccff,
      borderWidth = 1.5,
      borderDashSize = 0.2,
      borderGapSize = 0.12
    } = options;

    this.#color = color;
    this.#opacity = opacity;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: this.#color,
      transparent: true,
      opacity: this.#opacity,
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

    const borderGeo = new LineSegmentsGeometry();
    const borderMat = new LineMaterial({
      color: borderColor,
      linewidth: borderWidth,
      dashed: true,
      dashSize: borderDashSize,
      gapSize: borderGapSize,
      depthWrite: false,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
    });

    this.#borderMesh = new LineSegments2(borderGeo, borderMat);
    this.#borderMesh.renderOrder = 2;
    this.#borderMesh.frustumCulled = false;
    this.#borderMesh.visible = false;

    this.actor.world.renderer.on("resize", ({ width, height }) => {
      this.#borderMesh.material.resolution.set(width, height);
    });
  }

  awake() {
    this.actor.addChildren(this.#previewMesh);
    this.actor.addChildren(this.#borderMesh);
  }

  override destroy(): void {
    this.#previewMesh.geometry.dispose();
    (this.#previewMesh.material as THREE.Material).dispose();
    this.#borderMesh.geometry.dispose();
    this.#borderMesh.material.dispose();
    super.destroy();
  }

  set count(value: number) {
    this.#previewMesh.count = value;
    this.#borderMesh.visible = value > 0;
  }

  hide(): void {
    this.#previewMesh.visible = false;
    this.#borderMesh.visible = false;
  }

  show(): void {
    this.#previewMesh.visible = true;
    this.#borderMesh.visible = true;
  }

  updateFromPositions(
    positions: THREE.Vector3[]
  ) {
    this.#previewMesh.visible = true;
    const count = Math.min(positions.length, VoxelBrushPreview.Max);

    for (let i = 0; i < count; i++) {
      this.#dummy.position.set(
        positions[i].x + 0.5,
        positions[i].y + 0.5,
        positions[i].z + 0.5
      );
      this.#dummy.updateMatrix();
      this.#previewMesh.setMatrixAt(i, this.#dummy.matrix);
    }

    this.#previewMesh.count = count;
    this.#previewMesh.instanceMatrix.needsUpdate = true;

    if (count === 0) {
      this.#borderMesh.visible = false;

      return;
    }

    this.#borderMesh.geometry.setPositions(
      this.#buildBorderPositions(positions, count)
    );
    this.#borderMesh.computeLineDistances();
    this.#borderMesh.visible = true;
  }

  /**
   * Returns a flat positions array (start/end pairs) for the 12 edges
   * of each preview cube, suitable for LineSegmentsGeometry.setPositions().
   */
  #buildBorderPositions(
    positions: THREE.Vector3[],
    count: number
  ): number[] {
    const result: number[] = [];

    for (let i = 0; i < count; i++) {
      const x = positions[i].x;
      const y = positions[i].y;
      const z = positions[i].z;

      // Bottom-face corners (y)
      const b0x = x;
      const b0y = y;
      const b0z = z;
      const b1x = x + 1;
      const b1y = y;
      const b1z = z;
      const b2x = x + 1;
      const b2y = y;
      const b2z = z + 1;
      const b3x = x;
      const b3y = y;
      const b3z = z + 1;

      // Top-face corners (y+1)
      const t0x = x;
      const t0y = y + 1;
      const t0z = z;
      const t1x = x + 1;
      const t1y = y + 1;
      const t1z = z;
      const t2x = x + 1;
      const t2y = y + 1;
      const t2z = z + 1;
      const t3x = x;
      const t3y = y + 1;
      const t3z = z + 1;

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
