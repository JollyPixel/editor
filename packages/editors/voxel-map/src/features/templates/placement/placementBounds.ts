// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelTemplate,
  VoxelTransform
} from "@jolly-pixel/voxel.renderer";

export interface PlacementBounds {
  /**
   * Lowest world cell covered by the placed voxels.
   */
  min: VoxelCoord;
  /**
   * Cell extent on each axis.
   */
  size: VoxelCoord;
}

type TemplateFrame = Pick<VoxelTemplate, "pivot" | "size">;

/**
 * World cells covered by `template` once its pivot sits on `position` and
 * `transform` turns it, matching `VoxelTemplate.placedVoxels()`.
 */
export function placementBounds(
  template: TemplateFrame,
  transform: VoxelTransform,
  position: VoxelCoord
): PlacementBounds {
  const [low, high] = turnedCorners(template, transform);

  return {
    min: {
      x: position.x + low.x,
      y: position.y + low.y,
      z: position.z + low.z
    },
    size: {
      x: high.x - low.x + 1,
      y: high.y - low.y + 1,
      z: high.z - low.z + 1
    }
  };
}

/**
 * Pivot position that puts the lowest placed cell on `min`; the inverse of
 * `placementBounds()`.
 */
export function placementPositionOf(
  template: TemplateFrame,
  transform: VoxelTransform,
  min: VoxelCoord
): VoxelCoord {
  const [low] = turnedCorners(template, transform);

  return {
    x: min.x - low.x,
    y: min.y - low.y,
    z: min.z - low.z
  };
}

function turnedCorners(
  template: TemplateFrame,
  transform: VoxelTransform
): [low: VoxelCoord, high: VoxelCoord] {
  const { pivot, size } = template;
  const a = transform.transformOffset({
    x: -pivot.x,
    y: -pivot.y,
    z: -pivot.z
  });
  const b = transform.transformOffset({
    x: size.x - 1 - pivot.x,
    y: size.y - 1 - pivot.y,
    z: size.z - 1 - pivot.z
  });

  return [
    {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      z: Math.min(a.z, b.z)
    },
    {
      x: Math.max(a.x, b.x),
      y: Math.max(a.y, b.y),
      z: Math.max(a.z, b.z)
    }
  ];
}
