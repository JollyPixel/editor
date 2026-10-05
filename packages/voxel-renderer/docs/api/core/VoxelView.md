# VoxelView

Draws a [`VoxelDocument`](./VoxelDocument.md) as chunk meshes under a
`THREE.Group`. The view follows the document's commands on its own; edit the
document, then call `tick()` every frame. Several views can draw one document.

```ts
import { VoxelDocument, VoxelView, loadTilesets } from "@jolly-pixel/voxel.renderer";

const document = new VoxelDocument({ layers: ["Ground"] });
const view = new VoxelView(document, {
  tilesets: await loadTilesets([{ id: "default", src: "tileset.png", tileSize: 16 }])
});

scene.add(view.root);
view.init();

// each frame
view.tick(deltaTime);
```

Inside the JollyPixel engine, [`VoxelRenderer`](../engine/VoxelRenderer.md)
drives a view through the actor lifecycle.

## Options

| Option | Type | Description |
| --- | --- | --- |
| `tilesets` | `Iterable<TilesetSource>` | Preloaded atlases, see [`loadTilesets`](../tilesets/tilesets.md). |
| `shapes` | `BlockShape[]` | [Custom shapes](../blocks/BlockShape.md) registered after the built-in ones. |
| `collider` | `VoxelColliderFactory` | [Physics adapter](../collision/VoxelCollider.md); collision is off when omitted. |
| `inspector` | `VoxelInspectorOptions` | Initial [inspector](./VoxelInspector.md) state. |
| `rendering` | `VoxelRenderingOptions` | See below. |
| `lighting` | `VoxelLightingOptions` | See below. |
| `range` | `VoxelRangeOptions` | See below. |
| `meshing` | `VoxelMeshingOptions` | See below. |
| `requestFrame` | `() => void` | See [frame requests](#frame-requests). |
| `logger` | `VoxelLogger` | |

| Group | Option | Default | Description |
| --- | --- | --- | --- |
| `rendering` | `material` | `"lambert"` | `"lambert"` or `"standard"` (PBR). |
| | `customizer` | | `(material, tilesetId, surface) => void`, called once per new material. See [material customizers](../../concepts/rendering-and-meshing.md#material-customizers). |
| | `alphaTest` | `0.1` | Alpha-test cutoff; `0` disables discards. Blocks can set their own [`alphaCutoff`](../blocks/BlockSurface.md). |
| | `alphaToCoverage` | `false` | Mask blocks write MSAA coverage. Needs a multisampled target and an opaque canvas. |
| | `tileMinification` | `"average"` | `"average"` or `"nearest"`, see [tile minification](../../concepts/rendering-and-meshing.md#tile-minification). |
| `lighting` | `ambientOcclusion` | `0` | Strength from `0` (off) to `1`, see [ambient occlusion](../../concepts/rendering-and-meshing.md#ambient-occlusion). |
| | `castShadow` | `false` | |
| | `receiveShadow` | `false` | |
| `range` | `viewDistance` | `Infinity` | Chunks around `focus`; a number, `ViewDistanceOptions` or a [`ViewDistance`](../world/ViewDistance.md). |
| | `policy` | `"hide"` | What happens to built chunks leaving the view distance. |
| | `farDistance` | `Infinity` | Chunks from `focus` beyond which tiles draw as flat colours, see [far distance](../../concepts/rendering-and-meshing.md#far-distance). |
| `meshing` | `budgetMs` | `8` | Rebuild time per `tick()`; `0` rebuilds everything at once. |
| | `workers` | | See [mesh workers](#mesh-workers). |

`material`, `customizer`, `alphaTest` and `meshing` are read once. The others
can change at runtime through the settings objects below.

## Properties

```ts
readonly root: THREE.Group;
readonly document: VoxelDocument;
readonly shapes: BlockShapeRegistry;
readonly complements: BlockComplements;
readonly atlases: TilesetAtlases;
readonly inspector: VoxelInspector;
readonly rendering: VoxelRendering;
readonly lighting: VoxelLighting;
readonly range: VoxelRange;
readonly layerVisibility: VoxelLayerVisibility;
readonly pendingRebuilds: number;
focus: THREE.Vector3Like | null;
```

- `shapes` is the [shape registry](../blocks/BlockShape.md) used by this view.
- `complements` tells whether two shapes fill a cell together, see
  [merging shapes](#merging-shapes).
- `atlases` holds the [textures](../tilesets/TilesetAtlases.md) of the
  document's tilesets.
- `pendingRebuilds` counts chunks queued or being meshed in a worker.
- `focus` is a point in `root` local space, read on every tick. Chunks closest
  to it are meshed first, and the view distance is measured from it. Assigning
  a live vector once is enough.

### Settings

```ts
view.lighting.ambientOcclusion = 0.5;
view.rendering.tileMinification = "nearest";
view.range.farDistance = 10;
```

| Object | Writable fields |
| --- | --- |
| `rendering` | `tileMinification`, `alphaToCoverage` |
| `lighting` | `ambientOcclusion` (clamped to `0..1`), `castShadow`, `receiveShadow` |
| `range` | `viewDistance`, `policy`, `farDistance` |

### Layer visibility

```ts
view.layerVisibility.override("Ground", false);
view.layerVisibility.reset("Ground");
view.layerVisibility.clear();
view.layerVisibility.isVisible(layer);
```

Shows or hides a layer in this view only, keyed by layer name. The layer's own
`visible`, which is saved and used by `world.getVoxelAt()`, is unchanged, and
other views are not affected. `overrides` lists the active overrides.

## Lifecycle

```ts
init(): void;
tick(deltaTime: number): void;
flush(): void;
whenIdle(): Promise<void>;
dispose(): void;
```

- `init()` meshes the voxels already in the document.
- `tick()` rebuilds dirty chunks within `meshing.budgetMs`, or hands them to
  mesh workers.
- `flush()` rebuilds every pending chunk now, ignoring the budget.
- `whenIdle()` resolves once no chunk inside the view distance is left to mesh.
  It needs `tick()` or `flush()` to keep running and never resolves after
  `dispose()`.
- `dispose()` frees meshes, materials, textures and listeners. The document is
  left alone.

```ts
document.world.setVoxel("Ground", { position, blockId });
await view.whenIdle();
```

### Frame requests

For a host that renders on demand. The view calls `requestFrame` whenever it
changes outside `tick()`: after a document command, a load, a remesh, or a
mesh worker result. Keep ticking while `pendingRebuilds > 0`.

```ts
const view = new VoxelView(document, {
  requestFrame: () => runtime.world.invalidate()
});
runtime.world.keepAlive(() => view.pendingRebuilds > 0);
```

`view.requestFrame()` triggers the same call, for changes the view cannot see,
such as replacing an atlas image.

### Mesh workers

`meshing.workers` meshes chunks in Web Workers. The application provides the
worker script:

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
      createWorker: () => new Worker(new URL("./meshWorker.ts", import.meta.url), { type: "module" })
    }
  }
});
```

| Option | Default | Description |
| --- | --- | --- |
| `createWorker` | | Returns a `MeshWorkerPort`; a browser `Worker` works. |
| `count` | `navigator.hardwareConcurrency - 1`, at least `1` | |

The page must be cross-origin isolated
(`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`). Otherwise the option is ignored
with a warning and meshing stays on the main thread. A worker error also falls
back to the main thread.

With workers, `init()` and a load queue the world instead of meshing it; await
`whenIdle()` while ticking. `flush()` still meshes everything on the main
thread.

### View distance

Chunks beyond `range.viewDistance` from `focus` are not meshed and keep their
edits until they come back in range. Built chunks that leave the range follow
`range.policy`:

- `"hide"` keeps the geometry and hides the mesh.
- `"unload"` frees the geometry and remeshes the chunk on return.

```ts
view.range.viewDistance = new ViewDistance({ chunks: 12, shape: "sphere", hysteresis: 2 });
```

The view distance does nothing while `focus` is `null`, and it never affects
colliders.

## Methods

```ts
loadTileset(def: TilesetDefinition, texture: TilesetTexture, options?: { normal?: TilesetNormalTexture }): void;
load(data: VoxelWorldJSON, options?: VoxelViewLoadOptions): void;
markAllChunksDirty(source?: string): void;
requestFrame(): void;
```

`loadTileset()` declares the tileset on the document without a command and
registers its atlas. A known ID is updated in place and keeps its slot; a
loaded atlas is replaced. To share a new tileset with peers, use
[`document.addTileset()`](./VoxelDocument.md#commands). `options.normal` adds a
[normal map](../../concepts/rendering-and-meshing.md#normal-maps) laid out like
`texture`; loading again without it removes it.

A declared tileset without a texture hides its blocks until `loadTileset()`
provides one. A tileset removed from the document keeps its voxels, drawn with
the [missing-tileset texture](../tilesets/TilesetAtlases.md#missing-tileset).

`load()` registers the atlases a snapshot needs, then calls
[`document.load()`](./VoxelDocument.md#save-and-load) and meshes the world:

| Option | Type | Description |
| --- | --- | --- |
| `tilesets` | `Iterable<TilesetSource>` | Atlases to register first. Sources already loaded are ignored. |
| `mergeLayers` | `boolean \| VoxelMergeAllLayersOptions` | Passed to `document.load()`. |

A tileset the snapshot declares without an atlas logs a warning.

`markAllChunksDirty()` queues every chunk for a rebuild.

### Merging shapes

```ts
canMergeAt(layerName: string, position: THREE.Vector3Like, part: VoxelPart): boolean;
```

`true` when the layer holds a single voxel at `position` and `part` fills the
rest of its cell, so a `merge` write would form a
[merged cell](../world/VoxelWorld.md#merged-cells). Blocks are resolved
through `document.blocks`, shapes through `shapes`.

```ts
const part = { blockId: kSlabTop, transform: 0 };
if (view.canMergeAt("Ground", position, part)) {
  view.document.world.setVoxel("Ground", { position, blockId: kSlabTop, merge: true });
}
```

A merged cell is drawn without the faces its two shapes share, unless the
shape in front is not opaque. A neighbour sees it as a full cube when both
shapes are opaque.

```ts
partAt(layerName: string, position: THREE.Vector3Like, point: THREE.Vector3Like): VoxelPart | null;
```

The shape of the cell at `position` that contains `point`, given in world
space. A cell that is not merged returns its only shape wherever `point` is;
an empty cell or an unknown layer returns `null`.

A point on the surface between two shapes belongs to either. To find the shape
a raycast hit, step the hit point a little against the hit normal first, so it
lands inside the shape that owns the hit face:

```ts
const point = hit.point.clone().addScaledVector(hit.normal, -1e-4);
const part = view.partAt("Ground", cell, point);
```

## Document changes

The view reacts to the document on its own:

- Voxel and layer commands remesh the affected chunks.
- Block definitions and removals remesh the chunks holding the block, and their
  neighbours when culling can change. A definition that only moves its tiles
  (same tilesets and rotations, no blend group) or renames the block remeshes
  nothing: the chunks read the new tile rects on the next frame.
- Tileset commands update the atlases before other listeners run, then remesh
  every chunk.
- Material group changes update their materials; replacing a group remeshes
  every chunk.
- `loaded` clears every mesh and rebuilds the world.

To composite overlapping transparent blocks correctly, render the scene through
a [`VoxelTransparencyPassNode`](./VoxelTransparencyPassNode.md).
