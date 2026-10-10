// Import Third-party Dependencies
import type { AnimationSample } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  BlockTransformJSON,
  Vector3JSON
} from "../../network/types.ts";

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
    return copyOf({
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
        .filter((key) => !sameVector(transform[key], identity[key]))
        .map((key) => [key, { ...transform[key] }])
    );
  }

  static parse(
    value: unknown
  ): BlockTransformJSON | undefined {
    if (typeof value !== "object" || value === null) {
      return undefined;
    }

    const [position, pivotOffset, size, scale, rotation] = kTransformKeys.map(
      (key) => parseVector3(Reflect.get(value, key))
    );

    return (
      position === undefined ||
      pivotOffset === undefined ||
      size === undefined ||
      scale === undefined ||
      rotation === undefined
    ) ? undefined : { position, pivotOffset, size, scale, rotation };
  }

  readonly #rest: BlockTransformJSON;

  constructor(
    rest: BlockTransformJSON
  ) {
    this.#rest = copyOf(rest);
  }

  pose(
    sample: AnimationSample
  ): BlockTransformJSON {
    const rest = this.toJSON();

    return {
      ...rest,
      position: sample.position === undefined ?
        rest.position :
        combine(rest.position, sample.position, (base, delta) => base + delta),
      rotation: sample.rotation === undefined ?
        rest.rotation :
        combine(rest.rotation, sample.rotation, (base, delta) => base + (delta * kDegreesToRadians)),
      scale: sample.scale === undefined ?
        rest.scale :
        combine(rest.scale, sample.scale, (base, factor) => base * factor)
    };
  }

  deltaTo(
    pose: BlockTransformJSON
  ): Required<AnimationSample> {
    const rest = this.#rest;

    return {
      position: combine(pose.position, rest.position, (posed, base) => posed - base),
      rotation: combine(pose.rotation, rest.rotation, (posed, base) => (posed - base) / kDegreesToRadians),
      scale: combine(pose.scale, rest.scale, (posed, base) => (base === 0 ? 1 : posed / base))
    };
  }

  toJSON(): BlockTransformJSON {
    return copyOf(this.#rest);
  }
}

function copyOf(
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

function parseVector3(
  value: unknown
): Vector3JSON | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const x: unknown = Reflect.get(value, "x");
  const y: unknown = Reflect.get(value, "y");
  const z: unknown = Reflect.get(value, "z");

  return typeof x === "number" && typeof y === "number" && typeof z === "number" ?
    { x, y, z } :
    undefined;
}

function sameVector(
  left: Vector3JSON,
  right: Vector3JSON
): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function combine(
  base: Vector3JSON,
  delta: Vector3JSON,
  merge: (base: number, delta: number) => number
): Vector3JSON {
  return {
    x: merge(base.x, delta.x),
    y: merge(base.y, delta.y),
    z: merge(base.z, delta.z)
  };
}
