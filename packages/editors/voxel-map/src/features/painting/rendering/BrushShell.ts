// Import Internal Dependencies
import {
  BrushFootprint,
  type BrushShape
} from "../model/BrushFootprint.ts";
import { VoxelShell } from "./VoxelShell.ts";

// CONSTANTS
export const BRUSH_SHELL_INFLATE = 0.01;
const kShells = new Map<string, BrushShell>();

export class BrushShell {
  static fromShape(
    shape: BrushShape
  ): BrushShell {
    const footprint = new BrushFootprint({
      size: shape.size,
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

  constructor(
    footprint: BrushFootprint
  ) {
    const { span } = footprint.bounds;
    const { x, y, z } = footprint.center;

    this.local = VoxelShell.fromCells(footprint.cells()).scaledAround(
      [x, y, z],
      [
        (span.x + (BRUSH_SHELL_INFLATE * 2)) / span.x,
        (span.y + (BRUSH_SHELL_INFLATE * 2)) / span.y,
        (span.z + (BRUSH_SHELL_INFLATE * 2)) / span.z
      ]
    );
  }
}
