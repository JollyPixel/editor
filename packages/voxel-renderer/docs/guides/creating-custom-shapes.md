# Creating custom shapes

Extend `BlockShapeBase`, register an instance on the view, then name its id in
a block definition. This shape is a flat carpet lying just above the floor of
its cell:

```ts
import {
  BlockShapeBase,
  Face,
  VoxelDocument,
  VoxelView,
  defineFace,
  type FaceDefinition
} from "@jolly-pixel/voxel.renderer";

class Carpet extends BlockShapeBase {
  readonly id = "carpet";
  readonly collisionHint = "none";
  readonly faces: readonly FaceDefinition[] = [
    defineFace({
      face: Face.PosY,
      normal: [0, 1, 0],
      vertices: [
        [0, 0.0625, 1],
        [1, 0.0625, 1],
        [1, 0.0625, 0],
        [0, 0.0625, 0]
      ]
    })
  ];
}

const document = new VoxelDocument({ layers: ["Ground"] });
const view = new VoxelView(document, {
  shapes: [new Carpet()]
});

document.defineBlock({
  id: 10,
  name: "Red carpet",
  shapeId: "carpet",
  collidable: false,
  defaultTexture: { col: 0, row: 0 }
});
```

`view.shapes.register(new Carpet())` works too, for a view that already exists.

`defineFace()` fills in what the face leaves out. The face sits inside the
cell, so it is never culled against a neighbour, and its UVs are the
projection of its vertices, so it samples the whole tile.
`BlockShapeBase` derives `occludes()` from the faces: the carpet covers no
side of its cell, so it hides nothing behind it.

The [`BlockShape` reference](../api/blocks/BlockShape.md) covers the face
format, default culling, the UV convention and the built-in shapes.
