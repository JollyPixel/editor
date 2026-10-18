// Import Third-party Dependencies
import {
  surfaceHeight,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";

// CONSTANTS
const kSegments = 96;
const kLift = 0.05;
const kOuterColor = 0x33e0ff;
const kInnerColor = 0xffd166;
const kHaloColor = 0x0b0f14;

export interface BrushRingShape {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  /**
   * Radius of the inner ring, or null to draw none.
   */
  readonly innerRadius: number | null;
}

export class BrushRing extends THREE.Group {
  #outer = new LineSegmentsGeometry();
  #inner = new LineSegmentsGeometry();
  #lines: LineSegments2[];

  constructor() {
    super();

    this.name = "brush-ring";
    this.#lines = [
      ringLines(this.#outer, { color: kHaloColor, linewidth: 4 }, 10),
      ringLines(this.#outer, { color: kOuterColor, linewidth: 2 }, 11),
      ringLines(this.#inner, { color: kInnerColor, linewidth: 1.5 }, 11)
    ];
    this.add(...this.#lines);
    this.visible = false;
  }

  draw(
    terrain: TerrainReader,
    shape: BrushRingShape
  ): void {
    this.#outer.setPositions(ringPositions(terrain, shape, shape.radius));
    const inner = this.#lines[2];
    inner.visible = shape.innerRadius !== null;
    if (shape.innerRadius !== null) {
      this.#inner.setPositions(ringPositions(terrain, shape, shape.innerRadius));
    }
    this.visible = true;
  }

  override dispose(): void {
    this.#outer.dispose();
    this.#inner.dispose();
    for (const line of this.#lines) {
      line.material.dispose();
    }
    super.dispose();
  }
}

function ringLines(
  geometry: LineSegmentsGeometry,
  parameters: ConstructorParameters<typeof Line2NodeMaterial>[0],
  renderOrder: number
): LineSegments2 {
  const lines = new LineSegments2(
    geometry,
    new Line2NodeMaterial({
      depthTest: false,
      depthWrite: false,
      transparent: true,
      ...parameters
    })
  );
  lines.renderOrder = renderOrder;
  lines.frustumCulled = false;

  return lines;
}

function ringPositions(
  terrain: TerrainReader,
  { x, z }: BrushRingShape,
  radius: number
): number[] {
  const points: THREE.Vector3[] = [];
  for (let segment = 0; segment <= kSegments; segment++) {
    const angle = segment / kSegments * Math.PI * 2;
    const pointX = x + Math.cos(angle) * radius;
    const pointZ = z + Math.sin(angle) * radius;
    const height = surfaceHeight(terrain, pointX, pointZ) ?? surfaceHeight(terrain, x, z) ?? 0;
    points.push(new THREE.Vector3(pointX, height + kLift, pointZ));
  }

  const positions: number[] = [];
  for (let segment = 0; segment < kSegments; segment++) {
    positions.push(...points[segment].toArray(), ...points[segment + 1].toArray());
  }

  return positions;
}
