// Import Third-party Dependencies
import type { Vector3Like } from "three";

// CONSTANTS
const kRotationMask = 0b11;
const kFlipXBit = 0b100;
const kFlipZBit = 0b1000;
const kFlipYBit = 0b10000;
const kVariantCount = 32;
const kInterned = new Array<VoxelTransform | undefined>(kVariantCount);
const kRotationMatrices: readonly XzMatrix[] = [
  [1, 0, 0, 1],
  [0, 1, -1, 0],
  [-1, 0, 0, -1],
  [0, -1, 1, 0]
];
const kPackedByMatrix = new Uint8Array(81);
for (let packed = kFlipXBit | kRotationMask; packed >= 0; packed--) {
  kPackedByMatrix[matrixKey(xzMatrix(packed))] = packed;
}

type XzMatrix = readonly [number, number, number, number];

export const VOXEL_TRANSFORM_MASK = kVariantCount - 1;

export const VoxelRotation = {
  None: 0,
  CCW90: 1,
  Deg180: 2,
  CW90: 3
} as const;

/**
 * Quarter turns around Y: 0°, 90° CCW, 180°, 270° CCW.
 */
export type VoxelRotationStep = 0 | 1 | 2 | 3;

export interface VoxelTransformOptions {
  /**
   * Quarter turns around Y. Values outside 0..3 wrap.
   * @default 0
   */
  rotation?: number;
  /**
   * Mirrors the block around x = 0.5.
   * @default false
   */
  flipX?: boolean;
  /**
   * Mirrors the block around z = 0.5.
   * @default false
   */
  flipZ?: boolean;
  /**
   * Mirrors the block around y = 0.5.
   * @default false
   */
  flipY?: boolean;
}

/**
 * Immutable Y-rotation and mirror flags. Only 32 values exist, so instances
 * are interned and `fromPacked()` never allocates on a hot path.
 */
export class VoxelTransform {
  static readonly Identity: VoxelTransform = VoxelTransform.fromPacked(0);

  /**
   * Ignores bits outside `VOXEL_TRANSFORM_MASK`, so a whole transform byte
   * can be passed in.
   */
  static fromPacked(
    packed: number
  ): VoxelTransform {
    const bits = packed & VOXEL_TRANSFORM_MASK;

    let transform = kInterned[bits];
    if (transform === undefined) {
      transform = new VoxelTransform({
        rotation: bits & kRotationMask,
        flipX: (bits & kFlipXBit) !== 0,
        flipZ: (bits & kFlipZBit) !== 0,
        flipY: (bits & kFlipYBit) !== 0
      });
      kInterned[bits] = transform;
    }

    return transform;
  }

  static pack(
    options: VoxelTransformOptions = {}
  ): number {
    return ((options.rotation ?? 0) & kRotationMask) |
      (options.flipX ? kFlipXBit : 0) |
      (options.flipZ ? kFlipZBit : 0) |
      (options.flipY ? kFlipYBit : 0);
  }

  readonly rotation: VoxelRotationStep;
  readonly flipX: boolean;
  readonly flipZ: boolean;
  readonly flipY: boolean;

  /**
   * Rotation in bits 0-1, flipX in bit 2, flipZ in bit 3, flipY in bit 4.
   */
  readonly packed: number;

  constructor(
    options: VoxelTransformOptions = {}
  ) {
    const {
      rotation = 0,
      flipX = false,
      flipZ = false,
      flipY = false
    } = options;

    this.rotation = (rotation & kRotationMask) as VoxelRotationStep;
    this.flipX = flipX;
    this.flipZ = flipZ;
    this.flipY = flipY;
    this.packed = VoxelTransform.pack(options);

    Object.freeze(this);
  }

  equals(
    other: VoxelTransform
  ): boolean {
    return this.packed === other.packed;
  }

  /**
   * The transform that applies this one, then `outer`.
   */
  followedBy(
    outer: VoxelTransform
  ): VoxelTransform {
    const [ia, ib, ic, id] = xzMatrix(this.packed);
    const [oa, ob, oc, od] = xzMatrix(outer.packed);
    const turn = kPackedByMatrix[matrixKey([
      (oa * ia) + (ob * ic),
      (oa * ib) + (ob * id),
      (oc * ia) + (od * ic),
      (oc * ib) + (od * id)
    ])];

    return VoxelTransform.fromPacked(
      turn | ((this.packed ^ outer.packed) & kFlipYBit)
    );
  }

  /**
   * Moves a cell offset, measured from the cell this transform turns around,
   * the way the transform moves a block inside its cell.
   */
  transformOffset(
    offset: Vector3Like
  ): Vector3Like {
    const [a, b, c, d] = xzMatrix(this.packed);

    return {
      x: (a * offset.x) + (b * offset.z),
      y: this.flipY ? -offset.y : offset.y,
      z: (c * offset.x) + (d * offset.z)
    };
  }

  toJSON(): number {
    return this.packed;
  }
}

function xzMatrix(
  packed: number
): XzMatrix {
  const [a, b, c, d] = kRotationMatrices[packed & kRotationMask];
  const x = (packed & kFlipXBit) === 0 ? 1 : -1;
  const z = (packed & kFlipZBit) === 0 ? 1 : -1;

  return [a * x, b * x, c * z, d * z];
}

function matrixKey(
  matrix: XzMatrix
): number {
  const [a, b, c, d] = matrix;

  return ((a + 1) * 27) + ((b + 1) * 9) + ((c + 1) * 3) + d + 1;
}
