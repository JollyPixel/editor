# Creating custom shapes

Implement `BlockShape`, register the instance, then reference its ID from a
`BlockDefinition`.

```ts
import {
  VoxelEngine,
  type BlockShape,
  type Face,
  type FaceDefinition
} from "@jolly-pixel/voxel.renderer";

class MyShape implements BlockShape {
  readonly id = "myShape";
  readonly collisionHint = "box" as const;
  readonly faces: readonly FaceDefinition[] = [
    // Define triangles or quads in normalized block space.
  ];

  occludes(_face: Face): boolean {
    return false;
  }
}

const engine = new VoxelEngine({
  shapes: [new MyShape()]
});
```

`faces` use coordinates from 0 through 1 within a voxel. Return `true` from
`occludes()` only when the shape completely covers the requested axis-aligned
face. An incorrect `true` result removes visible geometry from neighbouring
blocks.

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
