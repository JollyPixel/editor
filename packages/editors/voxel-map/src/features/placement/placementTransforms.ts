// Import Third-party Dependencies
import type { VoxelTransformOptions } from "@jolly-pixel/voxel.renderer";

export interface PlacementTransform {
  icon: string;
  title: string;
  transform: VoxelTransformOptions;
}

export const PLACEMENT_TRANSFORMS: readonly PlacementTransform[] = [
  {
    icon: "rotate-ccw",
    title: "Rotate 90° counter-clockwise (Q)",
    transform: { rotation: 1 }
  },
  {
    icon: "rotate-cw",
    title: "Rotate 90° clockwise (E)",
    transform: { rotation: 3 }
  },
  {
    icon: "flip-x",
    title: "Mirror along X",
    transform: { flipX: true }
  },
  {
    icon: "flip-z",
    title: "Mirror along Z",
    transform: { flipZ: true }
  },
  {
    icon: "flip-y",
    title: "Mirror along Y",
    transform: { flipY: true }
  }
];
