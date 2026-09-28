# VoxelView

Draws a [`VoxelDocument`](./VoxelDocument.md). The view owns everything the
document does not: the `THREE.Group` holding the chunk meshes, the mesher, the
material cache, the atlas textures, the shape registry, the collider and the
inspector.

It subscribes to the document and keeps the meshes in step, so an application
edits the document and never tells the view what changed. Several views can
draw one document, and a document can live without any view (on a server, for
instance).

```ts
import {
  VoxelDocument,
  VoxelView,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";

const document = new VoxelDocument({ layers: ["Ground"] });
const view = new VoxelView(document, {
  tilesets: await loadTilesets([
    { id: "default", src: "tileset.png", tileSize: 16 }
  ])
});

scene.add(view.root);
view.init();

document.world.setVoxel("Ground", {
  position: { x: 0, y: 0, z: 0 },
  blockId: 1
});

// each frame
view.tick(deltaTime);
```

Inside the JollyPixel engine, [`VoxelRenderer`](../engine/VoxelRenderer.md)
drives a view through the actor lifecycle.

## VoxelViewOptions

Options are grouped by concern. `rendering`, `lighting` and `range` have a
runtime object of the same name (see [Settings](#settings)).

```ts
interface VoxelViewOptions {
  /** Collision factory called once with the registries; disabled when omitted. */
  collider?: VoxelColliderFactory;
  /** Shapes registered after the defaults from BlockShapeRegistry. */
  shapes?: BlockShape[];
  /** Preloaded atlases, see loadTilesets. */
  tilesets?: Iterable<TilesetSource>;
  logger?: VoxelLogger;
  /** Initial inspector state; mesh counters are collected in every mode. */
  inspector?: VoxelInspectorOptions;
  rendering?: VoxelRenderingOptions;
  lighting?: VoxelLightingOptions;
  range?: VoxelRangeOptions;
  meshing?: VoxelMeshingOptions;
}

type MaterialCustomizerFn = (
  material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial,
  tilesetId: string,
  surface: BlockSurface
) => void;

interface VoxelRenderingOptions {
  /** @default "lambert" */
  material?: "lambert" | "standard";
  /** Called once for each new material with its tileset ID and surface. */
  customizer?: MaterialCustomizerFn;
  /** @default 0.1 */
  alphaTest?: number;
  /** Mask blocks write coverage as MSAA sample coverage. @default false */
  alphaToCoverage?: boolean;
  /** Distant tiles average the texels they cover. @default "average" */
  tileMinification?: "average" | "nearest";
}

interface VoxelLightingOptions {
  /** 0 (off) to 1. @default 0 */
  ambientOcclusion?: number;
  /** @default false */
  castShadow?: boolean;
  /** @default false */
  receiveShadow?: boolean;
}

interface VoxelRangeOptions {
  /** Radius in chunks around focus. @default Infinity */
  viewDistance?: number | ViewDistanceOptions | ViewDistance;
  /** @default "hide" */
  policy?: "hide" | "unload";
  /** Chunks from focus; far chunks draw flat tile colours. @default Infinity */
  farDistance?: number;
}

interface VoxelMeshingOptions {
  /** Per-tick rebuild budget in milliseconds; 0 drains the queue. @default 8 */
  budgetMs?: number;
  /** Mesh chunks in Web Workers, see Mesh workers. */
  workers?: MeshWorkerOptions;
}
```

```ts
const view = new VoxelView(document, {
  rendering: {
    material: "standard",
    alphaTest: 0.5
  },
  lighting: {
    ambientOcclusion: 0.75,
    castShadow: true,
    receiveShadow: true
  },
  range: {
    viewDistance: 8,
    farDistance: 6
  },
  meshing: {
    budgetMs: 4
  }
});
```

A `customizer` must leave the material's `positionNode` alone, because chunk
vertices are rebuilt in the vertex shader (see
[vertex pulling](../../concepts/rendering-and-meshing.md#vertex-pulling)). The
material's `map` is `null`: the atlas is sampled by its color node. The
customizer runs after the finish of a
[material group](../materials/MaterialGroup.md) is applied, so it can override
it, and reads `surface.materialGroup` to tell grouped blocks apart. To
composite overlapping blended chunks, render the scene through a
[VoxelTransparencyPassNode](./VoxelTransparencyPassNode.md).

## Properties

```ts
class VoxelView {
  readonly root: THREE.Group;          // chunk meshes and inspector overlays
  readonly document: VoxelDocument;
  readonly shapes: BlockShapeRegistry;
  readonly atlases: TilesetAtlases;    // textures over document.tilesets
  readonly inspector: VoxelInspector;
  readonly rendering: VoxelRendering;
  readonly lighting: VoxelLighting;
  readonly range: VoxelRange;
  focus: THREE.Vector3Like | null;
  readonly pendingRebuilds: number;
}
```

The shape registry lives here, not on the document: a block's `shapeId` is
document state, but the shapes it names are code each client registers for
itself, and only the mesher, the collider and block previews read them.

Chunk meshes sit in a `"VoxelView:chunks"` group under `root`. A mesh outside
the view distance has `visible` set to `false`; the inspector's `"wireframe"`
mode hides the whole group.

## Settings

```ts
class VoxelRendering {
  tileMinification: "average" | "nearest"; // assigning replaces the materials
  alphaToCoverage: boolean;                // assigning replaces the materials
}

class VoxelLighting {
  ambientOcclusion: number; // clamped to 0..1; switching on or off rebuilds every chunk
  castShadow: boolean;      // assigning updates built chunks
  receiveShadow: boolean;   // assigning updates built chunks
}

class VoxelRange {
  viewDistance: ViewDistance;
  policy: "hide" | "unload";
  farDistance: number;      // chunks; applied on the next tick
}
```

```ts
view.lighting.ambientOcclusion = 0.5;
view.rendering.tileMinification = "nearest";
view.range.farDistance = 10;
```

`material`, `customizer`, `alphaTest` and the `meshing` group are read once at
construction.

## Lifecycle

```ts
init(): void;                   // meshes the voxels already present
tick(deltaTime: number): void;  // rebuilds dirty chunks within the budget, or dispatches them to mesh workers
flush(): void;                  // rebuilds every pending chunk now, ignoring the budget
whenIdle(): Promise<void>;      // resolves once no chunk in view is left to mesh
dispose(): void;                // frees meshes, materials, textures, listeners
```

`dispose()` unsubscribes from the document and frees the view's own resources.
It leaves the document alone, since other holders may still be using it.

### Rebuild budget

`tick()` spends at most `meshing.budgetMs` (default `8` ms) per frame and
defers the rest. Set to `0` to rebuild everything synchronously. `init()` and a
document load rebuild the whole world synchronously, unless
[mesh workers](#mesh-workers) are running. Use `flush()` when meshes must be
ready before the next line runs.

`pendingRebuilds` counts queued chunks and builds running in mesh workers, not
chunks edited since the last tick: those are dirty but not queued yet.
`whenIdle()` also waits for those. It resolves at once when nothing inside the
view distance is dirty or queued, otherwise at the end of the first `tick()` or
`flush()` that leaves nothing to mesh. Chunks beyond the view distance do not
hold it back. It never resolves after `dispose()`.

```ts
document.world.setVoxel("Ground", { position, blockId });
await view.whenIdle();    // the new voxel is meshed
```

### Mesh workers

`meshing.workers` moves chunk meshing to Web Workers. The application provides
the worker script, which calls `runMeshWorker()` on its global scope:

```ts
// meshWorker.ts
import { runMeshWorker } from "@jolly-pixel/voxel.renderer";

runMeshWorker(self);
```

```ts
const view = new VoxelView(document, {
  meshing: {
    workers: {
      count: 4,
      createWorker: () => new Worker(
        new URL("./meshWorker.ts", import.meta.url),
        { type: "module" }
      )
    }
  }
});
```

```ts
interface MeshWorkerOptions {
  createWorker: () => MeshWorkerPort; // a browser Worker satisfies MeshWorkerPort
  count?: number;                     // default: navigator.hardwareConcurrency - 1, at least 1
}

function runMeshWorker(scope: MeshWorkerScope): void; // self, or any MessagePort
```

Workers read chunk storage through `SharedArrayBuffer`, so the page must be
cross-origin isolated (`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`). Without isolation the option is
ignored, a warning is logged, and meshing stays on the main thread. Workers
are created on the first rebuild.

With workers running:

- `tick()` dispatches queued chunks to the workers and installs their meshes on
  a later `tick()`. Each worker holds two builds at a time and is handed the
  next queued chunk as soon as one finishes.
- `init()` and a document load queue the world instead of meshing it; await
  `whenIdle()` while ticking to know when it is drawn.
- `flush()` installs finished builds, then meshes every other pending chunk on
  the main thread, including the ones still running in a worker, whose results
  are then dropped.
- A build is dropped and its chunk remeshed when a chunk it read, or a block,
  shape or tileset definition, changed while it ran.
- A worker `error` event stops every worker; running and later builds fall
  back to the main thread and the error is logged.

Custom shapes reach workers as data: their `faces` and the six `occludes()`
answers.

### Focus

`focus` is a point in `root` local space, reread on every tick, so a live
vector can be assigned once. Without it the queue is drained in the order
chunks were created, which for a world generated from its origin means the
chunks nearest the camera are built last.

The queue is reordered when it grows and when the focus has drifted by half a
chunk, so a moving camera keeps pulling the nearest chunks forward.

### View distance

With a finite `range.viewDistance`, chunks further than that radius from
`focus` are not meshed at all and stay dirty until they come into range,
carrying every edit they missed. A queued chunk that falls out of range before
its turn, including one queued while `focus` was `null`, is skipped the same
way. Chunks already built when they leave the radius follow `range.policy`.

```ts
import { ViewDistance } from "@jolly-pixel/voxel.renderer";

view.range.viewDistance = new ViewDistance({
  chunks: 12,
  shape: "sphere",
  hysteresis: 2
});
```

`"hide"` keeps the geometry uploaded and only toggles mesh visibility, which
costs memory but makes coming back free. `"unload"` disposes the geometry and
remeshes the chunk on return. See [`ViewDistance`](../world/ViewDistance.md)
for the radius options.

Inside the view distance, chunks further than `range.farDistance` (in chunks,
from `focus` to a chunk centre) draw flat tile colours with opaque blend
blocks. The switch only swaps materials, so it never remeshes a chunk. See
[far distance](../../concepts/rendering-and-meshing.md#far-distance).

The view distance is visual only: colliders built for a chunk survive an
unload, so physics never depends on where the camera points. It also does
nothing while `focus` is `null`, and `flush()` does not force out-of-range
chunks to be meshed.

## Methods

```ts
loadTileset(def: TilesetDefinition, texture: TilesetTexture): void;
load(data: VoxelWorldJSON, options?: VoxelViewLoadOptions): void;
markAllChunksDirty(source?: string): void;
```

`loadTileset()` declares the tileset on the document *without* broadcasting a
command, then registers its atlas. An unknown ID is declared, a known one is
updated in place with its slot kept, which is how the tile size of an `asset`
tileset reaches the document. Loading an ID that already has an atlas replaces
it, so a resized source image or tile grid takes effect. An atlas loaded from
outside the edit stream is local to this client; use
[`VoxelDocument.addTileset()`](./VoxelDocument.md#methods) to tell peers
about one.

A tileset removed from the document keeps its voxels, drawn with the
[missing-tileset texture](../tilesets/TilesetAtlases.md#missing-tileset), a red
tile with a white cross. A declared tileset without a texture is different: its
blocks are not drawn and do not cull their neighbours until `loadTileset()`
provides the texture.

`load()` loads a snapshot into the document together with the atlases it uses:

```ts
interface VoxelViewLoadOptions {
  /** Collapse voxel layers after deserialization. */
  mergeLayers?: boolean;
  /** Atlases to register before the snapshot is meshed. */
  tilesets?: Iterable<TilesetSource>;
}
```

Sources whose atlas is already loaded are ignored. The others are declared and
their textures registered, then the document loads the snapshot and the world
is meshed. A tileset the snapshot declares without an atlas logs a warning and
its faces stay hidden until `loadTileset()` registers it. See
[`VoxelDocument.load()`](./VoxelDocument.md#methods) for what the snapshot
replaces.

`markAllChunksDirty()` marks every chunk dirty for a later rebuild.

## What it does with each document signal

| document | view |
| --- | --- |
| `command`, tileset actions | re-syncs the atlases, invalidates their materials, marks every chunk dirty |
| `command`, `block-defined` / `block-removed` | marks every chunk dirty |
| `command`, material group actions | updates the group's materials, marks every chunk dirty when one is replaced |
| `loaded` | clears the meshes, re-syncs atlases, rebuilds everything |

Atlases are re-synced before the command reaches any other listener, so code
subscribed to the document reads a tileset that already matches it.

The [rendering and meshing](../../concepts/rendering-and-meshing.md) concept
explains the chunk geometry layout and the rebuild queue.
