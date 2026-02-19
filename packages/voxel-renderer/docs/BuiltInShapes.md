# Built-In Shapes

All shapes below are registered automatically by `VoxelRenderer`. They are also available
standalone via `BlockShapeRegistry.createDefault()`.

---

## Shape Reference

- **`FullCube`** — `shapeId: "fullCube"`, `collisionHint: "box"`.
  Standard 1×1×1 cube. Occludes all 6 faces.

- **`HalfCube`** — `shapeId: "halfCubeBottom"`, `collisionHint: "box"`.
  Slab occupying the bottom half (`y = 0–0.5`). Occludes `-Y` only.

- **`HalfCube`** — `shapeId: "halfCubeTop"`, `collisionHint: "box"`.
  Slab occupying the top half (`y = 0.5–1`). Occludes `+Y` only.

- **`Ramp`** — `shapeId: "ramp"`, `collisionHint: "trimesh"`.
  Sloped surface rising from front (`-Z`) to back (`+Z`).

- **`CornerInner`** — `shapeId: "cornerInner"`, `collisionHint: "trimesh"`.
  Concave 270° corner piece.

- **`CornerOuter`** — `shapeId: "cornerOuter"`, `collisionHint: "trimesh"`.
  Convex 90° corner piece.

- **`Pillar`** — `shapeId: "pillar"`, `collisionHint: "box"`.
  Thin vertical column centred within the block space.

- **`Wedge`** — `shapeId: "wedge"`, `collisionHint: "trimesh"`.
  Triangular wedge — half a ramp cut diagonally.

---

## HalfCube — SlabType

```ts
type SlabType = "top" | "bottom";
```

Passed to the `HalfCube` constructor to select which half of the block space the slab occupies.

---

## Custom Shapes

Implement `BlockShape` and register the instance via the `shapes` option or `shapeRegistry.register()`:

```ts
import type { BlockShape, FaceDefinition, Face } from "@jolly-pixel/voxel.renderer";

class MyShape implements BlockShape {
  readonly id = "myShape";
  readonly collisionHint = "box" as const;
  readonly faces: readonly FaceDefinition[] = [
    // define triangles/quads in 0–1 block space
  ];

  occludes(_face: Face): boolean {
    return false; // return true only for fully covered faces
  }
}

// Option A — at construction time
const vr = actor.addComponentAndGet(VoxelRenderer, {
  shapes: [new MyShape()]
});

// Option B — at any time before voxels are placed
vr.shapeRegistry.register(new MyShape());
```

Then reference the shape in a `BlockDefinition`:

```ts
vr.blockRegistry.register({
  id: 10,
  name: "Custom",
  shapeId: "myShape",
  collidable: true,
  faceTextures: {},
  defaultTexture: { col: 0, row: 0 }
});
```
