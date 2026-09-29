// Import Internal Dependencies
import {
  BrushFootprint,
  type BrushShape
} from "../model/BrushFootprint.ts";
import {
  VoxelShell,
  type ShellPoint
} from "../model/VoxelShell.ts";
import { VoxelSolid } from "../model/VoxelSolid.ts";

// CONSTANTS
export const BRUSH_SHELL_INFLATE = 0.01;
const kShells = new Map<string, BrushShell>();

export class BrushShell {
  static of(
    shape: BrushShape
  ): BrushShell {
    const footprint = new BrushFootprint({
      size: shape.size,
      axis: shape.axis,
      pattern: shape.pattern,
      position: {
        x: 0,
        y: 0,
        z: 0
      }
    });
    const key = footprint.shapeKey;
    const cached = kShells.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const shell = new BrushShell(footprint);
    kShells.set(key, shell);

    return shell;
  }

  readonly local: VoxelShell;
  readonly #source: VoxelShell;
  readonly #solid: VoxelSolid | null;
  readonly #center: number[];
  readonly #scale: number[];

  constructor(
    footprint: BrushFootprint
  ) {
    const { span } = footprint.bounds;
    const { x, y, z } = footprint.center;
    const cells = footprint.cells();

    this.#source = VoxelShell.of(cells);
    this.#solid = footprint.isBall ? VoxelSolid.of(cells) : null;
    this.#center = [x, y, z];
    this.#scale = [
      (span.x + (BRUSH_SHELL_INFLATE * 2)) / span.x,
      (span.y + (BRUSH_SHELL_INFLATE * 2)) / span.y,
      (span.z + (BRUSH_SHELL_INFLATE * 2)) / span.z
    ];
    this.local = this.#source.scaledAround(this.#center, this.#scale);
  }

  get flat(): boolean {
    return this.#solid !== null;
  }

  facingKey(
    eye: number[]
  ): string {
    return this.#solid === null ?
      this.local.facingKey(eye) :
      eye.map((value) => value.toFixed(2)).join(":");
  }

  outline(
    eye: number[]
  ): number[] {
    if (this.#solid === null) {
      return this.local.edgesFacing(eye);
    }

    const center = this.#center;
    const scale = this.#scale;
    const sourceEye: ShellPoint = eye.map(
      (value, index) => (value / scale[index]) + center[index]
    );

    return this.#solid.contour(this.#source, sourceEye).map(
      (value, index) => (value - center[index % 3]) * scale[index % 3]
    );
  }
}
