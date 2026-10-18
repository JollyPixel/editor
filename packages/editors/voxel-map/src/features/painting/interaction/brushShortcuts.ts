// Import Third-party Dependencies
import type {
  KeyBindingHandler,
  KeyBindingHandlers
} from "@jolly-pixel/controls";
import type { AxisSign } from "@jolly-pixel/three";
import {
  VoxelTransform,
  type VoxelRotationStep
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  BrushStore,
  SelectionStore
} from "../../../state/index.ts";

export type BrushAction =
  | "brush.mode"
  | "brush.pattern"
  | "brush.ghost"
  | "orient.rotateCounterClockwise"
  | "orient.rotateClockwise"
  | "orient.flipVertical"
  | "orient.autoRotation";

export type BrushResizeAction = "brush.shrink" | "brush.grow";

export interface BrushShortcutsOptions {
  brush: BrushStore;
  selection: Pick<SelectionStore, "voxelLayer">;
}

export interface BrushOrientationOptions extends BrushShortcutsOptions {
  rotation: () => VoxelRotationStep;
}

export function brushShortcuts(
  options: BrushOrientationOptions
): KeyBindingHandlers<BrushAction> {
  const { brush, rotation } = options;

  function rotate(
    turns: AxisSign
  ): KeyBindingHandler {
    return whilePaintable(options, () => {
      brush.rotationMode = new VoxelTransform({
        rotation: rotation() + turns
      }).rotation;
    });
  }

  return {
    "brush.mode": whilePaintable(options, () => {
      brush.mode = brush.mode === "build" ? "replace" : "build";
    }),
    "brush.pattern": whilePaintable(options, () => {
      brush.pattern = brush.pattern === "square" ? "circle" : "square";
    }),
    "brush.ghost": whilePaintable(options, () => {
      brush.ghost = !brush.ghost;
    }),
    "orient.rotateCounterClockwise": rotate(1),
    "orient.rotateClockwise": rotate(-1),
    "orient.flipVertical": whilePaintable(options, () => {
      brush.flipY = !brush.flipY;
    }),
    "orient.autoRotation": whilePaintable(options, () => {
      brush.rotationMode = "auto";
    })
  };
}

export function brushResizeShortcuts(
  options: BrushShortcutsOptions
): KeyBindingHandlers<BrushResizeAction> {
  const { brush } = options;

  return {
    "brush.shrink": whilePaintable(options, () => {
      brush.resize(-1);
    }),
    "brush.grow": whilePaintable(options, () => {
      brush.resize(1);
    })
  };
}

function whilePaintable(
  options: BrushShortcutsOptions,
  action: () => void
): KeyBindingHandler {
  const { brush, selection } = options;

  return () => {
    if (selection.voxelLayer === null || brush.suspended) {
      return false;
    }
    action();

    return true;
  };
}
