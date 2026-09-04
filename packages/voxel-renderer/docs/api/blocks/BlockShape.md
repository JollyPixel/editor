# BlockShape

`BlockShape` describes the render and collision geometry for one shape ID. The
built-in implementations are listed in [built-in shapes](./built-in-shapes.md).

```ts
type BlockShapeID =
  | "cube"
  | "slabBottom"
  | "slabTop"
  | "poleY"
  | "pole"
  | "ramp"
  | "rampCornerInner"
  | "rampCornerOuter"
  | "stair"
  | "stairCornerInner"
  | "stairCornerOuter"
  | (string & {});

type BlockCollisionHint = "box" | "trimesh" | "none";

interface BlockShape {
  readonly id: BlockShapeID;
  readonly faces: readonly FaceDefinition[];
  readonly collisionHint: BlockCollisionHint;

  occludes(face: Face): boolean;
}
```

Unknown shape IDs compile because of the open string member, but the mesh
builder cannot resolve them unless they have been registered.

`occludes()` returns `true` when the shape completely covers the requested
axis-aligned face. Partial shapes return `false` so the mesh builder does not
remove visible neighbour geometry.

## FaceDefinition

```ts
interface FaceDefinition {
  face: Face;
  cull?: Face | null;
  normal: Vec3;
  vertices: readonly Vec3[];
  uvs: readonly Vec2[];
}
```

`face` selects the texture slot and default culling direction. An omitted
`cull` uses `face`; `null` disables culling. Vertices use normalized block space
and a face may contain three or four of them. A quad is triangulated as
`[0, 1, 2]` and `[0, 2, 3]`.

`uvs` are in normalized tile space, one per vertex.

## Face UV convention

Every built-in shape states each face's UVs as the orthographic projection of
its own vertices, seen from outside the block, with `u` growing to the viewer's
right and `v` upward:

| Slot | `u` | `v` |
|---|---|---|
| `PosX` | `z` | `y` |
| `NegX` | `1 - z` | `y` |
| `PosY` | `x` | `z` |
| `NegY` | `x` | `1 - z` |
| `PosZ` | `x` | `y` |
| `NegZ` | `1 - x` | `y` |

A face therefore samples exactly the part of the tile its geometry covers: a
`pole` side spans `u` `0.375` to `0.625` rather than the whole tile, and a
`slabBottom` side spans `v` `0` to `0.5`. One texture then reads continuously
across neighbouring blocks whatever their shapes, and the voxel-map UV editor
can size each face's region from the shape alone.

`projectFaceUv(face, vertex)` and `faceUvs(face, vertices)` compute the
projection. `projectedFace(definition)` builds a `FaceDefinition` whose `uvs`
default to it:

```ts
projectedFace({
  face: Face.PosZ,
  normal: [0, 0, 1],
  vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
});
```

Pass an explicit `uvs` to opt a face out, for instance to repeat or rotate a
tile deliberately.

## Face

```ts
const Face = {
  PosX: 0,
  NegX: 1,
  PosY: 2,
  NegY: 3,
  PosZ: 4,
  NegZ: 5
} as const;

type Face = typeof Face[keyof typeof Face];
```

See [creating custom shapes](../../guides/creating-custom-shapes.md) for a
complete registration example.
