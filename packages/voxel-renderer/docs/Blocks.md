# Blocks

Block definitions, shapes, registries, and the `Face` constant.

---

## BlockDefinition

Describes a block type: its shape, textures, and physics behaviour.

```ts
interface BlockDefinition {
  id: number;                                    // Unique ID — 0 is reserved for air
  name: string;                                  // Display name
  shapeId: BlockShapeID;
  faceTextures: Partial<Record<Face, TileRef>>;  // Per-face texture overrides
  defaultTexture?: TileRef;                      // Fallback for faces not in faceTextures
  collidable: boolean;                           // false = no collision geometry emitted
}
```

---

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

---

## BlockCollisionHint

```ts
type BlockCollisionHint = "box" | "trimesh" | "none";
```

- `"box"` — compound cuboids; one per solid voxel. Cheapest; best for full-cube worlds.
- `"trimesh"` — exact triangle mesh built from rendered geometry. Accurate for slopes;
  may ghost-collide on shared edges.
- `"none"` — no collision geometry. Use for decorative or trigger blocks.

---

## FaceDefinition

Geometry descriptor for one polygonal face of a block shape.

```ts
interface FaceDefinition {
  face: Face;                // Culling direction — which neighbour to check
  normal: Vec3;              // Outward normal (need not be axis-aligned)
  vertices: readonly Vec3[]; // 3 (triangle) or 4 (quad) positions in 0–1 block space
  uvs: readonly Vec2[];      // Same count as vertices, in 0–1 tile space
}
```

A quad is triangulated as `[0,1,2]` + `[0,2,3]`.

---

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

---

## BlockRegistry

Maps numeric block IDs to `BlockDefinition` objects. Accessible via `VoxelRenderer.blockRegistry`.

#### `register(def: BlockDefinition): this`

Registers a block definition. Throws if `def.id === 0`.

#### `get(id: number): BlockDefinition | undefined`

#### `has(id: number): boolean`

#### `getAll(): IterableIterator<BlockDefinition>`

---

## BlockShapeRegistry

Maps shape IDs to `BlockShape` implementations. Pre-populated with all built-in shapes
by `VoxelRenderer`. Accessible via `VoxelRenderer.shapeRegistry`.

#### `register(shape: BlockShape): this`

#### `get(id: BlockShapeID): BlockShape | undefined`

#### `has(id: BlockShapeID): boolean`

#### `static createDefault(): BlockShapeRegistry`

Creates a standalone registry pre-loaded with all built-in shapes.

---

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
