// Import Third-party Dependencies
import {
  goldenAngleColor,
  hashKey
} from "@jolly-pixel/color";
import type { Vector3Like } from "three";
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

export type ObjectAreaPatch = Required<
  Pick<VoxelObjectJSON, "x" | "y" | "z" | "width" | "height">
>;

export class MapObject {
  static create(
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

  static areaPatch(
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

  readonly data: VoxelObjectJSON;

  constructor(
    data: VoxelObjectJSON
  ) {
    this.data = data;
  }

  get derivedColor(): string {
    return goldenAngleColor(hashKey(this.data.id), kDerivedColor);
  }

  get color(): string {
    return this.data.color ?? this.derivedColor;
  }

  get locked(): boolean {
    return this.data.locked === true;
  }

  get area(): AreaTransform {
    const { x, y, z } = this.data;
    const footprint = VoxelFootprint.of(this.data);

    return {
      position: { x, y, z },
      size: {
        x: footprint.width,
        y: 1,
        z: footprint.height
      }
    };
  }

  hasArea(
    patch: ObjectAreaPatch
  ): boolean {
    const { data } = this;

    return data.x === patch.x &&
      data.y === patch.y &&
      data.z === patch.z &&
      VoxelFootprint.of(data).equals(
        new VoxelFootprint(patch.width, patch.height)
      );
  }

  isNoop(
    patch: Partial<VoxelObjectJSON>
  ): boolean {
    const entries = Object.entries(patch);

    return entries.length > 0 && entries.every(
      ([key, value]) => typeof value !== "object" &&
        this.data[key as keyof VoxelObjectJSON] === value
    );
  }
}

function roundCoordinate(
  value: number
): number {
  return Math.round(value) || 0;
}
