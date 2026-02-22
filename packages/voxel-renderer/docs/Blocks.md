# Blocks

Block definitions, shapes, registries, and the `Face` constant.

## BlockDefinition

Describes a block type: its shape, textures, and physics behaviour.

```ts
/**
 * Describes a block type: its shape, per-face texture tiles, and collidability.
 * Block ID 0 is always air and is never stored in the registry.
 */
export interface BlockDefinition {
  /**
   * Unique numeric identifier.
   * @note
   * 0 is reserved for air.
   **/
  id: number;
  /** Human-readable name for editor display. */
  name: string;
  /** ID of the BlockShape to use for geometry generation. */
  shapeId: BlockShapeID;
  /**
   * Per-face tile references.
   * If a face is absent, defaultTexture is used.
   * Allows blocks to have a different top texture from their sides.
   */
  faceTextures: Partial<Record<FACE, TileRef>>;
  /** Fallback tile used for any face not listed in faceTextures. */
  defaultTexture?: TileRef;
  /**
   * If false, the mesh builder will not emit
   * collision geometry for this block.
   **/
  collidable: boolean;
}
```

## BlockShapeID

```ts
type BlockShapeID =
  | "cube"
  | "slabBottom"
  | "slabTop"
  | "poleY"
  | "poleX"
  | "poleZ"
  | "poleCross"
  | "ramp"
  | "rampFlip"
  | "rampCornerInner"
  | "rampCornerOuter"
  | "rampCornerInnerFlip"
  | "rampCornerOuterFlip"
  | "stair"
  | "stairCornerInner"
  | "stairCornerOuter"
  | "stairFlip"
  | "stairCornerInnerFlip"
  | "stairCornerOuterFlip"
  | (string & {}); // custom shapes registered at runtime
```

> The `(string & {})` tail means any string compiles, but unknown IDs fail silently at
> runtime — the voxel is skipped. Always use a built-in ID or one registered via
> `BlockShapeRegistry.register()`.

![Available block shapes](./shapes.png)


## BlockCollisionHint

```ts
type BlockCollisionHint = "box" | "trimesh" | "none";
```

- `"box"` — compound cuboids; one per solid voxel. Cheapest; best for full-cube worlds.
- `"trimesh"` — exact triangle mesh built from rendered geometry. Accurate for slopes;
  may ghost-collide on shared edges.
- `"none"` — no collision geometry. Use for decorative or trigger blocks.

See [Collision](./Collision.md) for more information.

## FaceDefinition

Geometry descriptor for one polygonal face of a block shape.

```ts
interface FaceDefinition {
  /** Axis-aligned culling direction used to find the neighbor to check. */
  face: FACE;
  /** Outward-pointing surface normal (need not be axis-aligned). */
  normal: Vec3;
  /** 3 (triangle) or 4 (quad) positions in 0-1 block space. */
  vertices: readonly Vec3[];
  /** Same count as vertices; UV coordinates in 0-1 tile space. */
  uvs: readonly Vec2[];
}
```

A quad is triangulated as `[0,1,2]` + `[0,2,3]`.

## BlockShape

Interface implemented by all shape classes.

```ts
interface BlockShape {
  readonly id: BlockShapeID;
  readonly faces: readonly FaceDefinition[];
  readonly collisionHint: BlockCollisionHint;
  occludes(face: Face): boolean;
}
```

`occludes(face)` returns `true` only when the shape fully covers the given face, allowing
the mesh builder to skip the opposite face on the neighbour. Partial shapes (ramps, wedges)
must return `false` to avoid incorrect face culling.

## BlockRegistry

Maps numeric block IDs to `BlockDefinition` objects. Accessible via `VoxelRenderer.blockRegistry`.

#### `register(def: BlockDefinition): this`

Registers a block definition. Throws if `def.id === 0`.

#### `get(id: number): BlockDefinition | undefined`

#### `has(id: number): boolean`

#### `getAll(): IterableIterator<BlockDefinition>`

## BlockShapeRegistry

Maps shape IDs to `BlockShape` implementations. Pre-populated with all built-in shapes
by `VoxelRenderer`. Accessible via `VoxelRenderer.shapeRegistry`.

#### `register(shape: BlockShape): this`

#### `get(id: BlockShapeID): BlockShape | undefined`

#### `has(id: BlockShapeID): boolean`

#### `static createDefault(): BlockShapeRegistry`

Creates a standalone registry pre-loaded with all built-in shapes.

## Face

Axis-aligned face directions used for culling decisions and per-face texture references.

```ts
const Face = {
  PosX: 0, // +X
  NegX: 1, // -X
  PosY: 2, // +Y (top)
  NegY: 3, // -Y (bottom)
  PosZ: 4, // +Z
  NegZ: 5  // -Z
} as const;

type Face = typeof Face[keyof typeof Face];
```
