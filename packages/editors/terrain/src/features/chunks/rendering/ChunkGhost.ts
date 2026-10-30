// Import Third-party Dependencies
import {
  CHUNK_SAMPLES,
  surfaceHeight,
  type ChunkCoord,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import type { ChunkMode } from "../model/ChunkDrag.ts";

// CONSTANTS
const kSegmentsPerSide = 32;
const kLift = 0.05;
const kInset = 1e-3;
const kHaloColor = 0x0b0f14;
const kModeColors: Readonly<Record<ChunkMode, number>> = {
  add: 0x4ade80,
  remove: 0xff6b6b,
  detail: 0xfbbf24
};
const kRefusedColor = 0x8b949e;

export interface ChunkGhostShape {
  readonly coord: ChunkCoord;
  readonly height: number;
  readonly mode: ChunkMode;
  readonly accepted: boolean;
}

export class ChunkGhost extends THREE.Group {
  #geometry = new LineSegmentsGeometry();
  #halo: LineSegments2;
  #line: LineSegments2;
  #shown: string | null = null;

  constructor() {
    super();

    this.name = "chunk-ghost";
    this.#halo = ghostLines(this.#geometry, { color: kHaloColor, linewidth: 4 }, 10);
    this.#line = ghostLines(this.#geometry, { color: kModeColors.add, linewidth: 2 }, 11);
    this.add(this.#halo, this.#line);
    this.visible = false;
  }

  show(
    terrain: TerrainReader,
    shape: ChunkGhostShape
  ): boolean {
    const { coord, height, mode, accepted } = shape;
    const shown = `${coord.key}:${height}:${mode}:${accepted}`;
    if (this.visible && this.#shown === shown) {
      return false;
    }

    this.#geometry.setPositions(outlinePositions(terrain, shape));
    this.#line.material.color.set(accepted ? kModeColors[mode] : kRefusedColor);
    this.#shown = shown;
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
    this.#shown = null;
  }

  override dispose(): void {
    this.#geometry.dispose();
    this.#halo.material.dispose();
    this.#line.material.dispose();
    super.dispose();
  }
}

function ghostLines(
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

function outlinePositions(
  terrain: TerrainReader,
  { coord, height, mode }: ChunkGhostShape
): number[] {
  const { x: originX, z: originZ } = coord.originSample;
  const corners = [
    [originX, originZ],
    [originX + CHUNK_SAMPLES, originZ],
    [originX + CHUNK_SAMPLES, originZ + CHUNK_SAMPLES],
    [originX, originZ + CHUNK_SAMPLES]
  ];
  const points: THREE.Vector3[] = [];
  for (let side = 0; side < corners.length; side++) {
    const [fromX, fromZ] = corners[side];
    const [toX, toZ] = corners[(side + 1) % corners.length];
    for (let segment = 0; segment < kSegmentsPerSide; segment++) {
      const t = segment / kSegmentsPerSide;
      const x = fromX + (toX - fromX) * t;
      const z = fromZ + (toZ - fromZ) * t;
      const y = mode === "add" ?
        height :
        surfaceHeight(terrain, Math.min(x, toInside(originX)), Math.min(z, toInside(originZ))) ?? height;
      points.push(new THREE.Vector3(x, y + kLift, z));
    }
  }

  const positions: number[] = [];
  for (let index = 0; index < points.length; index++) {
    positions.push(...points[index].toArray(), ...points[(index + 1) % points.length].toArray());
  }

  return positions;
}

function toInside(
  origin: number
): number {
  return origin + CHUNK_SAMPLES - kInset;
}
