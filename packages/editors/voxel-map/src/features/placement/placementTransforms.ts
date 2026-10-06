// Import Third-party Dependencies
import type { KeyChordString } from "@jolly-pixel/controls";
import type { VoxelTransformOptions } from "@jolly-pixel/voxel.renderer";

export type PlacementAxis = "x" | "y" | "z";

export interface PlacementTransform {
  icon: string;
  title: string;
  transform: VoxelTransformOptions;
}

export interface PlacementRotation extends PlacementTransform {
  chords: readonly KeyChordString[];
}

export interface PlacementMirror extends PlacementTransform {
  axis: PlacementAxis;
}

export const PLACEMENT_ROTATIONS: readonly PlacementRotation[] = [
  {
    icon: "rotateCounterClockwise",
    title: "Rotate 90° counter-clockwise",
    chords: ["KeyQ"],
    transform: { rotation: 1 }
  },
  {
    icon: "rotateClockwise",
    title: "Rotate 90° clockwise",
    chords: ["KeyE"],
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
    transform: { flipY: true }
  }
];
