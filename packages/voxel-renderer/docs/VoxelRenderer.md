# VoxelRenderer

`ActorComponent` that renders a layered voxel world as chunked Three.js meshes.
Each chunk is rebuilt only when its content changes, keeping GPU work proportional to edits rather than world size.

Wraps a [`VoxelEngine`](./VoxelEngine.md) instance, exposed as `vr.engine`, and drives its
lifecycle from `awake`/`update`/`destroy`.

```ts
// Pre-load tilesets before constructing VoxelRenderer (no async in lifecycle).
const loader = new TilesetLoader();
await loader.fromTileDefinition({
  id: "default",
  src: "tileset.png",
  tileSize: 16
});

const vr = actor.addComponentAndGet(VoxelRenderer, {
  tilesetLoader: loader,
  layers: ["Ground"],
  blocks: [
    {
      id: 1,
      name: "Grass",
      shapeId: "cube",
      collidable: true,
      faceTextures: {},
      defaultTexture: {
        col: 0,
        row: 0
      }
    }
  ]
});

vr.engine.setVoxel("Ground", {
  position: { x: 0, y: 0, z: 0 },
  blockId: 1
});
```

See [VoxelEngine](./VoxelEngine.md) for `VoxelEngineOptions` (constructor options) and
the full `setVoxel` / layer / object-layer / serialization API.

### Hooks

See [Hooks](./Hooks.md) for more information
