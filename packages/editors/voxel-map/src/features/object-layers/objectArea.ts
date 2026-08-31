// Import Third-party Dependencies
import {
  goldenAngleColor,
  hashKey
} from "@jolly-pixel/color";
import type { Vector3Like } from "@jolly-pixel/three";
import {
  VoxelFootprint,
  type VoxelObjectJSON
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kDerivedColor = {
  saturation: 0.65,
  lightness: 0.55
};

export interface AreaTransform {
  position: Vector3Like;
  size: Vector3Like;
}

export interface ObjectKey {
  layerName: string;
  objectId: string;
}

export type ObjectAreaPatch = Required<
  Pick<VoxelObjectJSON, "x" | "y" | "z" | "width" | "height">
>;

function roundCoordinate(
  value: number
): number {
  return Math.round(value) || 0;
}

export function objectKey(
  layerName: string,
  objectId: string
): string {
  return `${layerName}:${objectId}`;
}

export function parseObjectKey(
  key: string
): ObjectKey {
  const separator = key.lastIndexOf(":");

  return {
    layerName: key.slice(0, separator),
    objectId: key.slice(separator + 1)
  };
}

/**
 * A visible 1x1 object filling `position`, the grid cell it is centered on.
 * Coordinates are snapped, since the engine stores whole cells.
 */
export function createObjectAt(
  name: string,
  position: Vector3Like
): VoxelObjectJSON {
  return {
    id: crypto.randomUUID(),
    name,
    x: roundCoordinate(position.x),
    y: roundCoordinate(position.y),
    z: roundCoordinate(position.z),
    visible: true
  };
}

/**
 * Stable hue an object falls back to, derived from its id. Worlds saved
 * before `color` existed render exactly as they used to.
 */
export function derivedColorOf(
  object: VoxelObjectJSON
): string {
  return goldenAngleColor(
    hashKey(object.id),
    kDerivedColor
  );
}

export function colorOf(
  object: VoxelObjectJSON
): string {
  return object.color ?? derivedColorOf(object);
}

export function isLocked(
  object: VoxelObjectJSON
): boolean {
  return object.locked === true;
}

export function areaTransformOf(
  object: VoxelObjectJSON
): AreaTransform {
  const footprint = VoxelFootprint.of(object);

  return {
    position: {
      x: object.x,
      y: object.y,
      z: object.z
    },
    size: {
      x: footprint.width,
      y: 1,
      z: footprint.height
    }
  };
}

export function objectPatchFromArea(
  min: Vector3Like,
  size: Vector3Like
): ObjectAreaPatch {
  return {
    x: roundCoordinate(min.x),
    y: roundCoordinate(min.y),
    z: roundCoordinate(min.z),
    ...new VoxelFootprint(size.x, size.z).toJSON()
  };
}

export function sameObjectArea(
  object: VoxelObjectJSON,
  patch: ObjectAreaPatch
): boolean {
  return object.x === patch.x &&
    object.y === patch.y &&
    object.z === patch.z &&
    VoxelFootprint.of(object).equals(
      new VoxelFootprint(patch.width, patch.height)
    );
}
