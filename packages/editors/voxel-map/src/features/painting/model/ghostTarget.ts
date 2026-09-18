// Import Third-party Dependencies
import {
  VoxelTransform,
  type VoxelCoord
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BrushMode } from "../../../app/state/index.ts";
import type { VoxelPaint } from "./BrushStroke.ts";

export interface GhostAim {
  place: VoxelCoord;
  remove: VoxelCoord;
}

export interface GhostStroke {
  paint: VoxelPaint | undefined;
  center: VoxelCoord | null;
}

export interface GhostTargetOptions {
  enabled: boolean;
  size: number;
  mode: BrushMode;
  aim: GhostAim | null;
  stroke: GhostStroke | null;
  paint: VoxelPaint;
  occupied: (position: VoxelCoord) => boolean;
}

export interface GhostTarget {
  position: VoxelCoord;
  blockId: number;
  transform: VoxelTransform;
  overlay: boolean;
}

export function ghostTargetOf(
  options: GhostTargetOptions
): GhostTarget | null {
  const {
    enabled,
    size,
    aim,
    stroke,
    occupied
  } = options;
  if (!enabled || size !== 1) {
    return null;
  }

  if (stroke !== null) {
    const { center, paint } = stroke;
    if (center === null || paint === undefined) {
      return null;
    }

    return targetOf(center, paint, occupied(center));
  }

  if (aim === null) {
    return null;
  }

  const overlay = options.mode === "replace";
  const position = overlay ? aim.remove : aim.place;
  if (occupied(position) !== overlay) {
    return null;
  }

  return targetOf(position, options.paint, overlay);
}

function targetOf(
  position: VoxelCoord,
  paint: VoxelPaint,
  overlay: boolean
): GhostTarget {
  return {
    position,
    blockId: paint.blockId,
    transform: new VoxelTransform({
      rotation: paint.rotation,
      flipY: paint.flipY
    }),
    overlay
  };
}
