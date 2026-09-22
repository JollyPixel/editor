<h1 align="center">
  Voxel.Renderer
</h1>

<p align="center">
  Three.js Voxel Engine
</p>

<p align="center">
  <img src="./docs/images/noise-world.png">
</p>

## 💡 Features

- Chunked world (default 16³) - only dirty chunks are rebuilt each frame, the rest are left alone
- Named layers with explicit visual compositing or cell replacement
- Toggle visibility, reorder, add/remove layers, and move them in world space
- Face culling between adjacent solid voxels to keep triangle counts low
- Optional greedy meshing (`greedy: true`) merging coplanar identical faces - about 3x fewer triangles on terrain
- Many built-in block shapes (cube, slabs, ramp, corners, pole, stairs) and a `BlockShape` interface for custom geometry
- Per-block transforms via a packed byte - 90° Y rotations and X/Z flips without duplicating definitions
- Multiple tilesets at different resolutions; tiles referenced by `{ tilesetId, col, row }`
- Per-face texture overrides on any block definition
- `"lambert"` (default) or `"standard"` (PBR) material modes
- Opaque, masked, and blended block surfaces with configurable sides and mask cutoff
- `save()` / `load()` round-trips the full world state as plain JSON
- Optional undo/redo of voxel edits (`history: { enabled: true }`), grouped per stroke with `begin()` / `commit()`
- `TiledConverter` to import Tiled `.tmj` maps in `"stacked"` or `"flat"` layer modes
- Optional physics through the backend-agnostic `VoxelCollider` interface, with `"box"` or `"trimesh"` colliders rebuilt per dirty chunk and a Rapier3D plugin included; zero extra dependency if omitted
- Compatible with JollyPixel engine logger
- Inspector (`engine.inspector`) exposing live face/triangle counts and a wireframe view of the meshed chunks

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm install @jolly-pixel/voxel.renderer
# or
$ yarn add @jolly-pixel/voxel.renderer
```

## 👀 Usage example

Load atlas textures before creating the engine:

```ts
import {
  Face,
  VoxelEngine,
  loadTilesets,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

const tilesets = await loadTilesets([
  {
    id: "default",
    src: "tileset/UV_cube.png",
    tileSize: 32
  }
]);

const blocks: BlockDefinition[] = [
  {
    id: 1,
    name: "Dirt",
    shapeId: "cube",
    collidable: true,
    defaultTexture: {
      tilesetId: "default",
      col: 2,
      row: 0
    },
    faceTextures: {
      [Face.PosY]: {
        tilesetId: "default",
        col: 0,
        row: 2
      }
    }
  }
];

const engine = new VoxelEngine({
  tilesets,
  layers: ["Ground"],
  blocks
});

scene.add(engine.root);
engine.init();
```

Place voxels through the engine:

```ts
for (let x = 0; x < 8; x++) {
  for (let z = 0; z < 8; z++) {
    engine.world.setVoxel("Ground", {
      position: {
        x,
        y: 0,
        z
      },
      blockId: 1
    });
  }
}
```

Call `engine.tick(deltaTime)` from the application's frame loop. Remove
`engine.root` and call `engine.dispose()` during teardown. ECS applications can
wrap these calls in a component local to the application; the renderer package
does not depend on an ECS runtime.

## 📚 Documentation

### Concepts and guides

- [Glossary](GLOSSARY.md): shared vocabulary for worlds, blocks, layers, and
  meshing.
- [World model](docs/concepts/world-model.md): layers, chunks, compositing, and
  ownership.
- [Transparency](docs/api/core/VoxelTransparencyRenderer.md): scene compositing, setup, and limitations.
- [Rendering and meshing](docs/concepts/rendering-and-meshing.md): dirty chunk
  rebuilds, geometry layout, and greedy meshing.
- [Loading tilesets](docs/guides/loading-and-restoring-tilesets.md),
  [creating custom shapes](docs/guides/creating-custom-shapes.md), and
  [saving worlds](docs/guides/saving-and-loading-worlds.md).
- [Adding physics](docs/guides/adding-physics.md),
  [Tiled import](docs/guides/importing-a-tiled-map.md)

### Core and world API

- [`VoxelDocument`](docs/api/core/VoxelDocument.md) (voxel data, headless),
  [`VoxelView`](docs/api/core/VoxelView.md) (the meshes drawn from it), and
  [`VoxelEngine`](docs/api/core/VoxelEngine.md) (both together).
- [`VoxelInspector`, mesh and block statistics](docs/api/core/VoxelInspector.md),
  [`VoxelHistory` undo/redo](docs/api/core/VoxelHistory.md), and
  [commands](docs/api/core/commands.md).
- [`VoxelWorld`](docs/api/world/VoxelWorld.md),
  [`VoxelLayer`](docs/api/world/VoxelLayer.md),
  [`VoxelChunk`](docs/api/world/VoxelChunk.md),
  [`VoxelStore`](docs/api/world/VoxelStore.md),
  [`VoxelTransform`](docs/api/world/VoxelTransform.md), and
  [`ViewDistance`](docs/api/world/ViewDistance.md).

### Blocks, tilesets, and rendering API

- [`BlockDefinition`](docs/api/blocks/BlockDefinition.md),
  [`BlockRegistry` and tileset block generation](docs/api/blocks/BlockRegistry.md),
  [`BlockShape`](docs/api/blocks/BlockShape.md),
  [`BlockTextures`](docs/api/blocks/BlockTextures.md),
  [`BlockShapeBase`](docs/api/blocks/BlockShapeBase.md), and
  [`BlockShapeRegistry`](docs/api/blocks/BlockShapeRegistry.md).
- [Built-in shapes](docs/api/blocks/built-in-shapes.md),
  [`buildShapeGeometry`](docs/api/blocks/buildShapeGeometry.md),
  [shape slots](docs/api/blocks/shapeSlots.md),
  [tilesets](docs/api/tilesets/tilesets.md),
  [`TilesetManager`](docs/api/tilesets/TilesetManager.md), and
  [`TilesetAtlas`](docs/api/tilesets/TilesetAtlas.md).
- [Rendering, meshing, and tile wrapping](docs/concepts/rendering-and-meshing.md),
  [`VoxelCollider`](docs/api/collision/VoxelCollider.md), and
  [`RapierVoxelCollider`](docs/api/collision/RapierVoxelCollider.md).

### Serialization and integration API

- [Serialization, document codec, and voxel objects](docs/api/serialization/serialization.md).
- [`TiledConverter`](docs/api/tiled/TiledConverter.md), including its JSON types.
- [`TiledMapAssetLoader`](docs/api/tiled/TiledMapAssetLoader.md), which packages a
  converted map as one `@jolly-pixel/asset` value.
- [`VoxelRenderer`](docs/api/engine/VoxelRenderer.md), the `@jolly-pixel/engine`
  actor component wrapping a `VoxelEngine`.

## 🚀 Running the examples

Seven interactive examples live in the `examples/` directory and are served by Vite. Start the dev server from the package root:

```bash
pnpm --filter @jolly-pixel/voxel.renderer dev
```

Then open one of these URLs in your browser:

| URL | Script | What it shows |
|---|---|---|
| `http://localhost:5173/` | `demo-physics.ts` | A 32×32 voxel terrain with a raised platform and a Rapier3D physics sphere you can roll around with arrow keys |
| `http://localhost:5173/tileset.html` | `demo-tileset.ts` | Every tile in `Tileset001.png` laid out as UV-mapped quads with col/row labels, plus a rotating textured cube |
| `http://localhost:5173/shapes.html` | `demo-shapes.ts` | All 19 built-in block shapes rendered as coloured meshes with a wireframe overlay and labelled name |
| `http://localhost:5173/tiled.html` | `demo-tiled.ts` | A multi-layer Tiled `.tmj` map imported via `TiledConverter` in `"stacked"` mode with WASD camera navigation |
| `http://localhost:5173/noise-world.html` | `demo-noise-world.ts` | A Minecraft-like world generated from simplex noise, with live renderer and mesh counters - the benchmark example |
| `http://localhost:5173/transparency.html` | `demo-transparency.ts` | A diorama for checking transparency and lighting: blended water and glass, cutout leaves/grates/windows with explicit alpha modes, an alpha-gradient probe for `alphaTest`, and live light, material and layer controls |

## 🧪 Benchmarks

### Noise-world benchmark

Use `noise-world.html` to measure the renderer under load. It builds a heightmap world from simplex noise and reports two separate costs: voxel writes via `setVoxel` and chunk meshing for dirty chunks.

It is configurable from the query string:

```text
/noise-world.html?size=512&chunk=32&seed=42
```

| Param | Default | Effect |
|---|---:|---|
| `size` | `256` | World width/depth in voxels (`size²` columns) |
| `chunk` | `16` | `chunkSize`; trades draw calls against rebuild cost |
| `seed` | `1337` | Terrain seed; the same seed always yields the same world |

### Headless benchmark

The browser HUD is only a sanity check; Vite's checker inflates timings. Run headless instead:

```bash
pnpm run bench
pnpm run bench --greedy
pnpm run bench:compare
```

Use the minimum of three runs when comparing numbers, since single runs can drift a lot on a throttled machine.

## 🔥 Troubleshooting

If something isn't working as expected, enable verbose logging to get detailed runtime output:

```ts
// Enable debug logs for the entire runtime
const { world } = runtime;
world.logger.setLevel("debug");
world.logger.enableNamespace("*");
```

Pass a custom logger to `VoxelEngine` when it is not hosted by a runtime:

```ts
import { Systems } from "@jolly-pixel/engine";
import { VoxelEngine } from "@jolly-pixel/voxel.renderer";

const engine = new VoxelEngine({
  logger: new Systems.Logger({
    level: "trace",
    namespaces: ["*"]
  })
});
```

## Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ pnpm run test
$ pnpm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
