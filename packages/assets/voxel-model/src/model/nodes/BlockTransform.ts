// Import Third-party Dependencies
import type { AnimationSample } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type { BlockTransformJSON } from "../types.ts";
import { blockTransformSchema } from "../VoxelModel.schema.ts";
import { Vector3 } from "./Vector3.ts";

// CONSTANTS
const kDegreesToRadians = Math.PI / 180;
const kTransformKeys = [
  "position",
  "pivotOffset",
  "size",
  "scale",
  "rotation"
] as const;

export class BlockTransform {
  static create(
    overrides: Partial<BlockTransformJSON> = {}
  ): BlockTransformJSON {
    return BlockTransform.#clone({
      position: { x: 0, y: 0, z: 0 },
      pivotOffset: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      scale: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 },
      ...overrides
    });
  }

  static compact(
    transform: BlockTransformJSON
  ): Partial<BlockTransformJSON> {
    const identity = BlockTransform.create();

    return Object.fromEntries(
      kTransformKeys
        .filter((key) => !Vector3.same(transform[key], identity[key]))
        .map((key) => [key, { ...transform[key] }])
    );
  }

  static parse(
    value: unknown
  ): BlockTransformJSON | undefined {
    const result = blockTransformSchema.safeParse(value);

    return result.success ? result.data : undefined;
  }

  static #clone(
    transform: BlockTransformJSON
  ): BlockTransformJSON {
    return {
      position: { ...transform.position },
      pivotOffset: { ...transform.pivotOffset },
      size: { ...transform.size },
      scale: { ...transform.scale },
      rotation: { ...transform.rotation }
    };
  }

  readonly #rest: BlockTransformJSON;

  constructor(
    rest: BlockTransformJSON
  ) {
    this.#rest = BlockTransform.#clone(rest);
  }

  pose(
    sample: AnimationSample
  ): BlockTransformJSON {
    const rest = this.toJSON();

    return {
      ...rest,
      position: sample.position === undefined ?
        rest.position :
        Vector3.combine(rest.position, sample.position, (base, delta) => base + delta),
      rotation: sample.rotation === undefined ?
        rest.rotation :
        Vector3.combine(rest.rotation, sample.rotation, (base, delta) => base + (delta * kDegreesToRadians)),
      scale: sample.scale === undefined ?
        rest.scale :
        Vector3.combine(rest.scale, sample.scale, (base, factor) => base * factor)
    };
  }

  deltaTo(
    pose: BlockTransformJSON
  ): Required<AnimationSample> {
    const rest = this.#rest;

    return {
      position: Vector3.combine(pose.position, rest.position, (posed, base) => posed - base),
      rotation: Vector3.combine(
        pose.rotation,
        rest.rotation,
        (posed, base) => (posed - base) / kDegreesToRadians
      ),
      scale: Vector3.combine(pose.scale, rest.scale, (posed, base) => (base === 0 ? 1 : posed / base))
    };
  }

  toJSON(): BlockTransformJSON {
    return BlockTransform.#clone(this.#rest);
  }
}
