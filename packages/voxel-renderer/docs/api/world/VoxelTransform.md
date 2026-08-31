# VoxelTransform

Immutable Y-rotation and mirror flags for a single voxel. It owns the bit layout
that [`VoxelChunk`](./VoxelChunk.md#packed-voxel-values) stores in the low byte
of a packed voxel.

Only 32 distinct transforms exist, so instances are interned: `fromPacked()`
allocates at most once per value and is safe to call from a mesh build.

## Constructor

```ts
new VoxelTransform(options?: VoxelTransformOptions)

interface VoxelTransformOptions {
  /** Quarter turns around Y. Values outside 0..3 wrap. Default: `0`. */
  rotation?: number;
  /** Mirrors the block around x = 0.5. Default: `false`. */
  flipX?: boolean;
  /** Mirrors the block around z = 0.5. Default: `false`. */
  flipZ?: boolean;
  /** Mirrors the block around y = 0.5. Default: `false`. */
  flipY?: boolean;
}
```

`rotation` accepts any number and wraps to `0..3`, so an out-of-range value from
a network payload normalizes instead of corrupting the neighbouring flip bits.

## Properties

```ts
class VoxelTransform {
  readonly rotation: VoxelRotationStep;
  readonly flipX: boolean;
  readonly flipZ: boolean;
  readonly flipY: boolean;

  // encoded form stored in a chunk
  readonly packed: number;
}

type VoxelRotationStep = 0 | 1 | 2 | 3;
```

Instances are frozen. `packed` lays the flags out as rotation in bits 0-1,
`flipX` in bit 2, `flipZ` in bit 3, and `flipY` in bit 4.

```ts
const VOXEL_TRANSFORM_MASK: number; // 0b11111
```

`packVoxel()` reserves a full byte for the transform, so the three bits above
`VOXEL_TRANSFORM_MASK` are unused and free for future flags.

## Static methods

#### `VoxelTransform.Identity: VoxelTransform`

No rotation, no mirroring. Packs to `0`.

#### `VoxelTransform.fromPacked(packed: number): VoxelTransform`

Decodes a packed transform, ignoring bits outside `VOXEL_TRANSFORM_MASK`. It
accepts a whole packed voxel's transform byte, not just the five meaningful
bits.

## Methods

#### `equals(other: VoxelTransform): boolean`

Compares the packed forms.

#### `toJSON(): number`

Returns `packed`, so a transform serializes as the number a chunk stores.

## Example

```ts
import { VoxelTransform } from "@jolly-pixel/voxel.renderer";

const transform = new VoxelTransform({
  rotation: 1,
  flipX: true
});

layer.setVoxelAt(
  { x: 0, y: 0, z: 0 },
  { blockId: 3, transform: transform.packed }
);

const stored = layer.getVoxelAt({ x: 0, y: 0, z: 0 });
VoxelTransform.fromPacked(stored.transform).rotation; // 1
```
