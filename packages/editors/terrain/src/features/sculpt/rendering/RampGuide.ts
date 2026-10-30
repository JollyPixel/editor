// Import Third-party Dependencies
import {
  surfaceHeight,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import type { StrokeSegment } from "../../brush/model/BrushToolHandler.ts";

// CONSTANTS
const kSegments = 48;
const kLift = 0.05;
const kCentreColor = 0xffd166;
const kEdgeColor = 0x33e0ff;
const kHaloColor = 0x0b0f14;

export class RampGuide extends THREE.Group {
  #centre = new LineSegmentsGeometry();
  #edges = new LineSegmentsGeometry();
  #lines: LineSegments2[];
  #drawn = "";

  constructor() {
    super();

    this.name = "ramp-guide";
    this.#lines = [
      guideLines(this.#centre, { color: kHaloColor, linewidth: 4 }, 10),
      guideLines(this.#centre, { color: kCentreColor, linewidth: 2 }, 11),
      guideLines(this.#edges, { color: kEdgeColor, linewidth: 1.5 }, 11)
    ];
    this.add(...this.#lines);
    this.visible = false;
  }

  show(
    terrain: TerrainReader,
    { from, to }: StrokeSegment,
    radius: number
  ): boolean {
    const key = `${from.x},${from.z},${to.x},${to.z},${radius}`;
    if (this.visible && key === this.#drawn) {
      return false;
    }

    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const side = length === 0 ?
      { x: 0, z: 0 } :
      { x: -(to.z - from.z) / length, z: (to.x - from.x) / length };
    this.#centre.setPositions(trackPositions(terrain, from, to, 0, side));
    this.#edges.setPositions([
      ...trackPositions(terrain, from, to, radius, side),
      ...trackPositions(terrain, from, to, -radius, side)
    ]);
    this.#drawn = key;
    this.visible = true;

    return true;
  }

  hide(): boolean {
    if (!this.visible) {
      return false;
    }

    this.visible = false;

    return true;
  }

  terrainChanged(): void {
    this.#drawn = "";
  }

  override dispose(): void {
    this.#centre.dispose();
    this.#edges.dispose();
    for (const line of this.#lines) {
      line.material.dispose();
    }
    super.dispose();
  }
}

function guideLines(
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

function trackPositions(
  terrain: TerrainReader,
  from: StrokeSegment["from"],
  to: StrokeSegment["to"],
  offset: number,
  side: { x: number; z: number; }
): number[] {
  const points: THREE.Vector3[] = [];
  for (let segment = 0; segment <= kSegments; segment++) {
    const t = segment / kSegments;
    const x = from.x + (to.x - from.x) * t + side.x * offset;
    const z = from.z + (to.z - from.z) * t + side.z * offset;
    points.push(new THREE.Vector3(x, (surfaceHeight(terrain, x, z) ?? 0) + kLift, z));
  }

  const positions: number[] = [];
  for (let segment = 0; segment < kSegments; segment++) {
    positions.push(...points[segment].toArray(), ...points[segment + 1].toArray());
  }

  return positions;
}
