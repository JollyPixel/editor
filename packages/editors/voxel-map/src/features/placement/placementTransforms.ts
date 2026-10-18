// Import Third-party Dependencies
import type {
  Axis,
  AxisSign
} from "@jolly-pixel/three";
import type { VoxelTransformOptions } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapGroupAction } from "../../keybindings/MapKeyBindings.ts";

export type PlacementAxis = Axis;

export interface PlacementTransform {
  icon: string;
  title: string;
  transform: VoxelTransformOptions;
  action?: MapGroupAction<"orient">;
}

export interface PlacementRotation extends PlacementTransform {
  turns: AxisSign;
  action: MapGroupAction<"orient">;
}

export interface PlacementMirror extends PlacementTransform {
  axis: PlacementAxis;
}

export const PLACEMENT_ROTATIONS: readonly PlacementRotation[] = [
  {
    icon: "rotateCounterClockwise",
    title: "Rotate 90° counter-clockwise",
    turns: 1,
    action: "orient.rotateCounterClockwise",
    transform: { rotation: 1 }
  },
  {
    icon: "rotateClockwise",
    title: "Rotate 90° clockwise",
    turns: -1,
    action: "orient.rotateClockwise",
    transform: { rotation: 3 }
  }
];

export const PLACEMENT_MIRRORS: readonly PlacementMirror[] = [
  {
    icon: "flip-x",
    title: "Mirror along X",
    axis: "x",
    transform: { flipX: true }
  },
  {
    icon: "flip-z",
    title: "Mirror along Z",
    axis: "z",
    transform: { flipZ: true }
  },
  {
    icon: "flip-y",
    title: "Mirror along Y",
    axis: "y",
    action: "orient.flipVertical",
    transform: { flipY: true }
  }
];
