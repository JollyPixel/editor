# BlockShapeBase

`BlockShapeBase` implements `occludes()` from the shape's own `faces`, so a
shape states its silhouette once instead of keeping a hand-written table in
sync with its vertices.

```ts
import {
  BlockShapeBase,
  defineFace,
  Face
} from "@jolly-pixel/voxel.renderer";

class Wedge extends BlockShapeBase {
  readonly id = "wedge";
  readonly collisionHint = "trimesh";
  readonly faces = [
    defineFace({
      face: Face.NegY,
      normal: [0, -1, 0],
      vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]
    })
  ];
}
```

Every built-in shape extends it. The mask is computed on first call and cached,
because `faces` is only assigned once the subclass constructor has run.

## The rule

A slot occludes when the polygons lying on its boundary plane cover that whole
unit square. `occlusionMaskOf(faces)` applies it directly and returns a bitmask
indexed by `Face`:

- a face is ignored unless `isBoundaryFace()` accepts it, so an inset `slabTop`
  underside or a `ramp` slope never contributes
- the areas of the polygons sharing a slot are summed, so the two quads a
  `stair` puts on `PosX` count together and still fall short of 1
- the sum is compared against 1, so a `slabBottom` side wall covering half its
  plane does not occlude while its full `NegY` bottom does

Polygons sharing a slot are assumed not to overlap. Two coplanar faces drawn
over each other would sum past 1 and wrongly report occlusion; split them
instead, as the built-in stairs do.

Override `occludes()` when the vertices cannot say what you mean, for example a
shape that renders a full quad through an alpha mask and must not hide the
block behind it.
