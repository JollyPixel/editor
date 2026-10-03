# VoxelTransform

Immutable quarter-turn rotation around Y and mirror flags for one voxel.
`world.setVoxel()` takes the same options and packs them for you.

```ts
import { VoxelRotation, VoxelTransform } from "@jolly-pixel/voxel.renderer";

document.world.setVoxel("Ground", {
  position: { x: 0, y: 0, z: 0 },
  blockId: 3,
  rotation: VoxelRotation.CW90,
  flipX: true
});

const { transform } = document.world.getVoxelAt({ x: 0, y: 0, z: 0 });
VoxelTransform.fromPacked(transform).rotation; // 3
```

## Options

```ts
new VoxelTransform(options?: VoxelTransformOptions)
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `rotation` | `number` | `0` | Quarter turns around Y. Values outside `0..3` wrap. |
| `flipX` | `boolean` | `false` | Mirrors the block around `x = 0.5`. |
| `flipZ` | `boolean` | `false` | Mirrors the block around `z = 0.5`. |
| `flipY` | `boolean` | `false` | Mirrors the block around `y = 0.5`, for ceiling ramps and upside-down stairs. |

The flips combine freely with each other and with `rotation`.

## VoxelRotation

```ts
const VoxelRotation = {
  None: 0,
  CCW90: 1,
  Deg180: 2,
  CW90: 3
} as const;

type VoxelRotationStep = 0 | 1 | 2 | 3;
```

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `rotation` | `VoxelRotationStep` | Quarter turns around Y, wrapped to `0..3`. |
| `flipX`, `flipZ`, `flipY` | `boolean` | Mirror flags. |
| `packed` | `number` | Encoded form, the `transform` of a `VoxelEntry`. |

`VOXEL_TRANSFORM_MASK` covers the bits of `packed` that carry meaning.

## Static members

#### `VoxelTransform.Identity`

No rotation, no mirroring. Packs to `0`.

#### `VoxelTransform.fromPacked(packed: number): VoxelTransform`

Decodes a packed transform. Bits outside `VOXEL_TRANSFORM_MASK` are ignored.

#### `VoxelTransform.pack(options?: VoxelTransformOptions): number`

The `packed` value `new VoxelTransform(options)` would hold.

## Methods

#### `equals(other: VoxelTransform): boolean`

#### `followedBy(outer: VoxelTransform): VoxelTransform`

The transform that applies this one, then `outer`.

#### `transformOffset(offset: Vector3Like): Vector3Like`

Moves a whole-cell offset from the pivot cell the way the transform moves a
block. Returns a new object.

#### `toJSON(): number`

Returns `packed`.
