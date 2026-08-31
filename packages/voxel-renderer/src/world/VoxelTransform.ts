// CONSTANTS
const kRotationMask = 0b11;
const kFlipXBit = 0b100;
const kFlipZBit = 0b1000;
const kFlipYBit = 0b10000;
const kVariantCount = 32;
const kInterned = new Array<VoxelTransform | undefined>(kVariantCount);

export const VOXEL_TRANSFORM_MASK = kVariantCount - 1;

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
    this.packed = this.rotation |
      (flipX ? kFlipXBit : 0) |
      (flipZ ? kFlipZBit : 0) |
      (flipY ? kFlipYBit : 0);

    Object.freeze(this);
  }

  equals(
    other: VoxelTransform
  ): boolean {
    return this.packed === other.packed;
  }

  toJSON(): number {
    return this.packed;
  }
}
