// Import Third-party Dependencies
import type { VoxelTransformOptions } from "@jolly-pixel/voxel.renderer";

export interface TransformButton {
  label: string;
  title: string;
  transform: VoxelTransformOptions;
}

export interface RotationKeys {
  left: string;
  right: string;
}

export function transformButtons(
  pivot: string,
  keys?: RotationKeys
): TransformButton[] {
  return [
    {
      label: "Rotate left",
      title: `Rotate 90° counter-clockwise around ${pivot}${hintOf(keys?.left)}`,
      transform: { rotation: 1 }
    },
    {
      label: "Rotate right",
      title: `Rotate 90° clockwise around ${pivot}${hintOf(keys?.right)}`,
      transform: { rotation: 3 }
    },
    {
      label: "Flip X",
      title: `Mirror along X through ${pivot}`,
      transform: { flipX: true }
    },
    {
      label: "Flip Z",
      title: `Mirror along Z through ${pivot}`,
      transform: { flipZ: true }
    },
    {
      label: "Flip Y",
      title: `Mirror along Y through ${pivot}`,
      transform: { flipY: true }
    }
  ];
}

function hintOf(
  key: string | undefined
): string {
  return key === undefined ? "" : ` (${key})`;
}
