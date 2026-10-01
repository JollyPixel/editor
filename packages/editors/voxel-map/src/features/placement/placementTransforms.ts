// Import Third-party Dependencies
import type { KeyChordString } from "@jolly-pixel/controls";
import type { VoxelTransformOptions } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { PLACEMENT_SHORTCUTS } from "./placementShortcuts.ts";

export interface PlacementTransform {
  icon: string;
  title: string;
  shortcut: KeyChordString | null;
  transform: VoxelTransformOptions;
}

export const PLACEMENT_TRANSFORMS: readonly PlacementTransform[] = [
  {
    icon: "rotate-ccw",
    title: "Rotate 90° counter-clockwise",
    shortcut: PLACEMENT_SHORTCUTS.rotateCounterClockwise[0],
    transform: { rotation: 1 }
  },
  {
    icon: "rotate-cw",
    title: "Rotate 90° clockwise",
    shortcut: PLACEMENT_SHORTCUTS.rotateClockwise[0],
    transform: { rotation: 3 }
  },
  {
    icon: "flip-x",
    title: "Mirror along X",
    shortcut: null,
    transform: { flipX: true }
  },
  {
    icon: "flip-z",
    title: "Mirror along Z",
    shortcut: null,
    transform: { flipZ: true }
  },
  {
    icon: "flip-y",
    title: "Mirror along Y",
    shortcut: null,
    transform: { flipY: true }
  }
];
