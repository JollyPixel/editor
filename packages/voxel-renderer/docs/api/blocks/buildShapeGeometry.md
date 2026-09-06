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
  slot: string;
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

Polygons are grouped by texture slot, so each slot owns one contiguous vertex
range. A face may carry several slots: a `stair` puts its two `PosY` quads on
different planes, so they become `top` and `top.1` and take a tile each, while
its two `PosX` quads share the plane `x=1` and stay on one slot whose coverage
is an L. See [Shape slots](./shapeSlots.md).

`ranges` holds one entry per slot the shape uses, ordered by `Face`, and skips
slots the shape never renders. A `ramp` therefore returns five ranges, with no
entry for `NegZ`, while a `stair` returns eight. Each range also carries the
`definitions` it was built from, so a consumer that needs the source polygons
does not have to filter `shape.faces` again.

Ranges are the hook for per-face texturing: walk them, resolve the block's
`tileRefForSlot(block, range.slot)`, and rewrite that slice of `uvs`.

```ts
for (const range of ranges) {
  const tile = tileRefForSlot(block, range.slot);
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
