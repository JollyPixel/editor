# buildShapeGeometry

Triangulates a [`BlockShape`](./BlockShape.md) into one indexed buffer for
tools that render a single block: a library thumbnail, a UV editor preview, an
inspector. The chunk mesher does not use it; it builds merged geometry through
its own path.

```ts
import { buildShapeGeometry } from "@jolly-pixel/voxel.renderer";

const { positions, normals, uvs, indices, ranges } = buildShapeGeometry(shape);
```

```ts
interface ShapeGeometry {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  ranges: readonly ShapeFaceRange[];
}

interface ShapeFaceRange {
  face: Face;
  start: number;
  count: number;
  definitions: readonly FaceDefinition[];
}
```

Positions are in normalized block space, so `0` to `1` on each axis; recenter
them yourself if the consumer expects an origin-centred mesh. UVs are in
normalized tile space, before any atlas mapping.

## Face ranges

Polygons are grouped by face slot, so each slot owns one contiguous vertex
range. This matters because a shape may emit several polygons into the same
slot: a `stair` splits `PosY` into two quads, and `stairCornerOuter` splits it
into four. Iterating `shape.faces` directly would interleave those slots.

`ranges` holds one entry per slot the shape uses, ordered by `Face`, and skips
slots the shape never renders. A `ramp` therefore returns five ranges, with no
entry for `NegZ`. Each range also carries the `definitions` it was built from,
so a consumer that needs the source polygons does not have to filter
`shape.faces` again.

Ranges are the hook for per-face texturing: walk them, resolve the block's
`faceTextures[range.face]`, and rewrite that slice of `uvs`.

```ts
for (const range of ranges) {
  const tile = block.faceTextures[range.face] ?? block.defaultTexture;
  const end = range.start + range.count;

  for (let index = range.start; index < end; index++) {
    // remap uvs[index * 2] and uvs[(index * 2) + 1] into the tile
  }
}
```

## Triangulation

A face is fan-triangulated, which covers both the triangle and quad cases a
`FaceDefinition` allows. A face with fewer than three vertices contributes
vertices but no triangles.
