// Import Third-party Dependencies
import type { KeyChordString } from "@jolly-pixel/controls";
import type { VoxelTransformOptions } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { PLACEMENT_SHORTCUTS } from "./placementShortcuts.ts";

export type PlacementAxis = "x" | "y" | "z";

export interface PlacementTransform {
  icon: string;
  title: string;
  axis: PlacementAxis | null;
  shortcut: KeyChordString | null;
  transform: VoxelTransformOptions;
}

export const PLACEMENT_TRANSFORMS: readonly PlacementTransform[] = [
  {
    icon: "rotateCounterClockwise",
    title: "Rotate 90° counter-clockwise",
    axis: null,
    shortcut: PLACEMENT_SHORTCUTS.rotateCounterClockwise[0],
    transform: { rotation: 1 }
  },
  {
    icon: "rotateClockwise",
    title: "Rotate 90° clockwise",
    axis: null,
    shortcut: PLACEMENT_SHORTCUTS.rotateClockwise[0],
    transform: { rotation: 3 }
  },
  {
    icon: "flip-x",
    title: "Mirror along X",
    axis: "x",
    shortcut: null,
    transform: { flipX: true }
  },
  {
    icon: "flip-z",
    title: "Mirror along Z",
    axis: "z",
    shortcut: null,
    transform: { flipZ: true }
  },
  {
    icon: "flip-y",
    title: "Mirror along Y",
    axis: "y",
    shortcut: null,
    transform: { flipY: true }
  }
];
