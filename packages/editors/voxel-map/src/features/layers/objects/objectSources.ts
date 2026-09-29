// Import Third-party Dependencies
import type {
  FieldSource,
  Vec3Like
} from "@jolly-pixel/ui";
import {
  VoxelFootprint,
  type VoxelObjectJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapObject } from "./MapObject.ts";

export type ObjectFootprint = Record<"x" | "z", number>;

export interface ObjectPort {
  object(): VoxelObjectJSON | null;
  patch(patch: Partial<VoxelObjectJSON>): void;
}

export function objectColorSource(
  port: ObjectPort
): FieldSource<string> {
  return {
    read: () => {
      const object = port.object();

      return object === null ? "#000000" : new MapObject(object).color;
    },
    write: (value) => {
      const object = port.object();
      if (object === null) {
        return;
      }

      const derived = new MapObject(object).derivedColor;
      applyPatch(port, object, {
        color: sameColor(value, derived) ? undefined : value
      });
    }
  };
}

export function objectPositionSource(
  port: ObjectPort
): FieldSource<Vec3Like> {
  return {
    read: () => {
      const object = port.object();

      return {
        x: object?.x ?? 0,
        y: object?.y ?? 0,
        z: object?.z ?? 0
      };
    },
    write: (value) => {
      const object = port.object();
      if (object === null) {
        return;
      }

      applyPatch(port, object, {
        x: Math.round(value.x),
        y: Math.round(value.y),
        z: Math.round(value.z)
      });
    }
  };
}

export function objectSizeSource(
  port: ObjectPort
): FieldSource<ObjectFootprint> {
  return {
    read: () => {
      const object = port.object();
      const footprint = object === null ?
        new VoxelFootprint(1, 1) :
        VoxelFootprint.of(object);

      return {
        x: footprint.width,
        z: footprint.height
      };
    },
    write: (value) => {
      const object = port.object();
      if (object === null) {
        return;
      }

      applyPatch(
        port,
        object,
        new VoxelFootprint(value.x, value.z).toJSON()
      );
    }
  };
}

function applyPatch(
  port: ObjectPort,
  object: VoxelObjectJSON,
  patch: Partial<VoxelObjectJSON>
): void {
  if (new MapObject(object).isNoop(patch)) {
    return;
  }

  port.patch(patch);
}

function sameColor(
  left: string,
  right: string
): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
