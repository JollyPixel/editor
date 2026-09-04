# Creating custom shapes

Extend `BlockShapeBase`, register the instance, then reference its ID from a
`BlockDefinition`.

```ts
import {
  BlockShapeBase,
  VoxelEngine,
  defineFace,
  type Face,
  type FaceDefinition
} from "@jolly-pixel/voxel.renderer";

class MyShape extends BlockShapeBase {
  readonly id = "myShape";
  readonly collisionHint = "box" as const;
  readonly faces: readonly FaceDefinition[] = [
    defineFace({
      face: Face.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [1, 0.5, 1], [0, 0.5, 1]]
    })
  ];
}

const engine = new VoxelEngine({
  shapes: [new MyShape()]
});
```

`faces` use coordinates from 0 through 1 within a voxel, as triangles or quads.
`defineFace()` settles the two members you may leave out:

- `uvs` default to the projection of the face's own vertices, so it samples
  only the part of the tile it covers; see the
  [face UV convention](../api/blocks/BlockShape.md#face-uv-convention)
- `cull` defaults to the face's own direction, but only when the face lies on
  that direction's boundary plane, so a face inset into the block needs no
  annotation; see
  [default culling](../api/blocks/BlockShape.md#default-culling)

Pass either explicitly to opt out.

`BlockShapeBase` derives `occludes()` from those faces, so the shape above
correctly hides nothing. Implement `BlockShape` directly, or override
`occludes()`, only when the vertices cannot say what you mean; see
[`BlockShapeBase`](../api/blocks/BlockShapeBase.md). An incorrect `true` result
removes visible geometry from neighbouring blocks.

Registering through `engine.shapeRegistry` is also supported:

```ts
engine.shapeRegistry.register(new MyShape());
```

Register the shape before placing blocks that use it. Then add a matching block
definition:

```ts
engine.blockRegistry.register({
  id: 10,
  name: "Custom",
  shapeId: "myShape",
  collidable: true,
  defaultTexture: {
    col: 0,
    row: 0
  }
});
```

The [`BlockShape` reference](../api/blocks/BlockShape.md) documents face culling
and collision hints. The [built-in shape catalog](../api/blocks/built-in-shapes.md)
provides examples of the supported shape IDs.
