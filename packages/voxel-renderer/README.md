<h1 align="center">
  voxel.renderer
</h1>

<p align="center">
  JollyPixel Voxel Engine and Renderer
</p>

## 📌 About

Chunked voxel engine and renderer built for Three.js and the JollyPixel ECS engine. Drop in the `VoxelRenderer` ActorComponent to add multi-layer voxel worlds — with tileset textures, face culling, block transforms, JSON save/load, and optional Rapier3D physics — to any JollyPixel scene.

## 💡 Features

- **`VoxelRenderer` ActorComponent** — full ECS lifecycle integration (`awake`, `update`, `destroy`) with automatic dirty-chunk detection and frame-accurate mesh rebuilds.
- **Chunked rendering** — the world is partitioned into fixed-size chunks (default 16³). Only modified chunks are rebuilt each frame; unchanged chunks are never touched.
- **Multiple named layers** — add any number of named layers (`"Ground"`, `"Decoration"`, …). Layers composite from highest priority to lowest, so decorative layers override base terrain non-destructively without Z-fighting.
- **Layer controls** — toggle visibility, reorder layers, add or remove layers, and move entire layers in world space (`setLayerOffset` / `translateLayer`) at runtime.
- **Face culling** — shared faces between adjacent solid voxels are suppressed to minimize triangle count.
- **Block shapes** — eight built-in shapes (`fullCube`, `halfCubeBottom`, `halfCubeTop`, `ramp`, `cornerInner`, `cornerOuter`, `pillar`, `wedge`) plus a `BlockShape` interface for fully custom geometry.
- **Block transforms** — place any block at 90° Y-axis rotations and X/Z flips via a packed `transform` byte, without duplicating block definitions.
- **Multi-tileset texturing** — load multiple tileset PNGs at different resolutions. Blocks reference tiles by `{ tilesetId, col, row }` coordinates. GPU textures are shared across chunk meshes.
- **Per-face texture overrides** — `faceTextures` on a `BlockDefinition` lets individual faces use a different tile from the block's default tile.
- **Material options** — `"lambert"` (default, fast) or `"standard"` (PBR, roughness/metalness).
- **Cutout transparency** — configurable `alphaTest` threshold (default `0.1`) for foliage and sprite-style blocks. Set `0` to disable.
- **JSON serialization** — `save()` / `load()` round-trip the entire world state (layers, voxels, tileset metadata) as a plain JSON object. Compatible with `localStorage`, file I/O, and network APIs.
- **Tiled map import** — `TiledConverter` converts Tiled `.tmj` exports to `VoxelWorldJSON`, mapping Tiled layers and tilesets to VoxelRenderer layers and tilesets. Supports `"stacked"` and `"flat"` layer modes.
- **Optional Rapier3D physics** — pass a `{ api, world }` object to enable automatic collider generation per chunk. Colliders are rebuilt only when a chunk is dirty. No hard Rapier dependency — omit the option to keep physics out of the bundle entirely.
- **Collision strategies** — `"box"` shapes generate compound cuboid colliders (best performance for full-cube terrain); `"trimesh"` shapes generate a mesh collider per chunk (best accuracy for ramps and diagonals).
- **2D Tiled Map conversion**

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/voxel.renderer
# or
$ yarn add @jolly-pixel/voxel.renderer
```

## 👀 Usage example

### Basic — place voxels manually

```ts
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import { VoxelRenderer, type BlockDefinition } from "@jolly-pixel/voxel.renderer";

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const runtime = new Runtime(canvas);
const { world } = runtime;

const blocks: BlockDefinition[] = [
  {
    id: 1,
    name: "Dirt",
    shapeId: "fullCube",
    collidable: true,
    faceTextures: {},
    defaultTexture: { tilesetId: "default", col: 2, row: 0 }
  }
];

const voxelMap = world.createActor("map")
  .addComponentAndGet(VoxelRenderer, {
    chunkSize: 16,
    layers: ["Ground"],
    blocks
  });

// Load the tileset — resolves before awake() runs thanks to the runtime splash delay
voxelMap.loadTileset({
  id: "default",
  src: "tileset/Tileset001.png",
  tileSize: 32,
  cols: 9,
  rows: 4
}).catch(console.error);

// Place a flat 8×8 ground plane
for (let x = 0; x < 8; x++) {
  for (let z = 0; z < 8; z++) {
    voxelMap.setVoxel("Ground", { position: { x, y: 0, z }, blockId: 1 });
  }
}

loadRuntime(runtime).catch(console.error);
```

### Tiled import — convert a `.tmj` map

```ts
import { VoxelRenderer, TiledConverter, type TiledMap } from "@jolly-pixel/voxel.renderer";

// No blocks or layers needed here — load() restores them from the JSON snapshot
const voxelMap = world.createActor("map")
  .addComponentAndGet(VoxelRenderer, { alphaTest: 0.1, material: "lambert" });

const tiledMap = await fetch("tilemap/map.tmj").then((r) => r.json()) as TiledMap;

const worldJson = new TiledConverter().convert(tiledMap, {
  // Map Tiled .tsx source references to the PNG files served by your dev server
  resolveTilesetSrc: (src) => "tilemap/" + src.replace(/\.tsx$/, ".png"),
  layerMode: "stacked"
});

// Kick off deserialization concurrently with the runtime splash (~850 ms)
// so textures are ready before awake() runs
voxelMap.load(worldJson).catch(console.error);
await loadRuntime(runtime);
```

### Save and restore world state

```ts
// Save to localStorage
const json = voxelMap.save();
localStorage.setItem("map", JSON.stringify(json));

// Restore from localStorage
const data = JSON.parse(localStorage.getItem("map")!) as VoxelWorldJSON;
await voxelMap.load(data);
```

### Layer positioning — move a layer in world space

```ts
// Place a prefab layer at local origin
const prefab = voxelMap.addLayer("Prefab");
voxelMap.setVoxel("Prefab", { position: { x: 0, y: 0, z: 0 }, blockId: 2 });

// Snap the whole layer to world position {8, 0, 0}
voxelMap.setLayerOffset("Prefab", { x: 8, y: 0, z: 0 });

// Nudge it one unit up on the next tick
voxelMap.translateLayer("Prefab", { x: 0, y: 1, z: 0 });
// The layer now renders at {8, 1, 0}
```

Offsets are stored in the JSON snapshot and restored automatically on `load()`.

### Rapier3D physics

```ts
import Rapier from "@dimforge/rapier3d-compat";

await Rapier.init();
const rapierWorld = new Rapier.World({ x: 0, y: -9.81, z: 0 });

// Step physics once per fixed tick, before the scene update
world.on("beforeFixedUpdate", () => rapierWorld.step());

const voxelMap = world.createActor("map")
  .addComponentAndGet(VoxelRenderer, {
    chunkSize: 16,
    layers: ["Ground"],
    blocks,
    rapier: { api: Rapier, world: rapierWorld }
  });
```

## 📚 API

- [VoxelRenderer](docs/VoxelRenderer.md) - Main `ActorComponent` — options, voxel placement, tileset loading, save/load.
- [World](docs/World.md) - `VoxelWorld`, `VoxelLayer`, `VoxelChunk`, and related types.
- [Blocks](docs/Blocks.md) - `BlockDefinition`, `BlockShape`, `BlockRegistry`, `BlockShapeRegistry`, and `Face`.
- [Tileset](docs/Tileset.md) - `TilesetManager`, `TilesetDefinition`, `TileRef`, UV regions.
- [Serialization](docs/Serialization.md) - `VoxelSerializer` and JSON snapshot types.
- [Collision](docs/Collision.md) - Rapier3D integration, `VoxelColliderBuilder`, and physics interfaces.
- [Built-In Shapes](docs/BuiltInShapes.md) - All built-in block shapes and custom shape authoring.
- [TiledConverter](docs/TiledConverter.md) - Converting Tiled `.tmj` exports to `VoxelWorldJSON`.

## Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
