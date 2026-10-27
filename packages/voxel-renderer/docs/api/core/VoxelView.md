# VoxelView

Draws a [`VoxelDocument`](./VoxelDocument.md) as chunk meshes under a
`THREE.Group`. The view follows the document's commands on its own; edit the
document, then call `tick()` every frame. Several views can draw one document.

```ts
import { VoxelDocument, VoxelView, loadBlocksets } from "@jolly-pixel/voxel.renderer";

const document = new VoxelDocument({ layers: ["Ground"] });
const view = new VoxelView(document, {
  blocksets: await loadBlocksets([{ id: "default", src: "blockset.png", tileSize: 16 }])
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
| `blocksets` | `Iterable<AtlasSource>` | Preloaded atlases, see [`loadBlocksets`](../blocksets/blocksets.md). |
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
| | `customizer` | | `(material, blocksetId, surface) => void`, called once per new material. See [material customizers](#material-customizers). |
| | `alphaTest` | `0.1` | Alpha-test cutoff; `0` disables discards. Blocks can set their own [`alphaCutoff`](../blocks/BlockSurface.md). |
| | `alphaToCoverage` | `false` | Mask blocks write MSAA coverage. Needs a multisampled target and an opaque canvas. |
| | `tileMinification` | `"average"` | `"average"` or `"nearest"`, see [tile minification](#tile-minification). |
| `lighting` | `ambientOcclusion` | `0` | Strength from `0` (off) to `1`, see [ambient occlusion](#ambient-occlusion). |
| | `blockLight` | `1` | Strength of the light glowing blocks cast, `0` or more, see [block light](#block-light). |
| | `blockLightFalloff` | `"wide"` | `"wide"` or `"focused"`, how block light fades with distance. |
| | `shadowFill` | `0` | How much block light washes out received shadows, `0` or more. |
| | `castShadow` | `false` | |
| | `receiveShadow` | `false` | |
| `range` | `viewDistance` | `Infinity` | Chunks around `focus`; a number, `ViewDistanceOptions` or a [`ViewDistance`](../world/ViewDistance.md). |
| | `policy` | `"hide"` | What happens to built chunks leaving the view distance. |
| | `farDistance` | `Infinity` | Chunks from `focus` beyond which tiles draw as flat colours, see [far distance](#far-distance). |
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
readonly atlases: BlocksetAtlases;
readonly inspector: VoxelInspector;
readonly rendering: VoxelRendering;
readonly lighting: VoxelLighting;
readonly range: VoxelRange;
readonly layerVisibility: VoxelLayerVisibility;
readonly pendingRebuilds: number;
readonly meshVersion: number;
focus: THREE.Vector3Like | null;
```

- `shapes` is the [shape registry](../blocks/BlockShape.md) used by this view.
- `complements` tells whether two shapes fill a cell together, see
  [merging shapes](#merging-shapes).
- `atlases` holds the [textures](../blocksets/BlocksetAtlases.md) of the
  document's blocksets.
- `pendingRebuilds` counts chunks queued or being meshed in a worker.
- `meshVersion` increases whenever a chunk mesh is added, removed, culled,
  shown again, or swaps its material. Compare it between frames to redraw a
  static shadow map only after the meshes change.
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
| `lighting` | `ambientOcclusion` (clamped to `0..1`), `blockLight` (`0` or more), `blockLightFalloff` (rewrites every lit chunk's light texture), `shadowFill` (`0` or more), `castShadow`, `receiveShadow` |
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
colliders. Frustum culling still applies on top.

## Methods

```ts
loadBlockset(def: BlocksetDefinition, texture: AtlasTexture, options?: { normal?: AtlasNormalTexture }): void;
load(data: VoxelWorldJSON, options?: VoxelViewLoadOptions): void;
markAllChunksDirty(source?: string): void;
requestFrame(): void;
```

`loadBlockset()` declares the blockset on the document without a command and
registers its atlas. A known ID is updated in place and keeps its slot; a
loaded atlas is replaced. To share a new blockset with peers, use
[`document.addBlockset()`](./VoxelDocument.md#commands). `options.normal` adds a
[normal map](#normal-maps) laid out like
`texture`; loading again without it removes it.

A declared blockset without a texture hides its blocks until `loadBlockset()`
provides one. A blockset removed from the document keeps its voxels, drawn with
the [missing-blockset texture](../blocksets/BlocksetAtlases.md#missing-blockset).

`load()` registers the atlases a snapshot needs, then calls
[`document.load()`](./VoxelDocument.md#save-and-load) and meshes the world:

| Option | Type | Description |
| --- | --- | --- |
| `blocksets` | `Iterable<AtlasSource>` | Atlases to register first. Sources already loaded are ignored. |
| `mergeLayers` | `boolean \| VoxelMergeAllLayersOptions` | Passed to `document.load()`. |

A blockset the snapshot declares without an atlas logs a warning.

`markAllChunksDirty()` queues every chunk for a rebuild.

### Merging shapes

```ts
canMergeVoxelPart(layerName: string, position: THREE.Vector3Like, part: VoxelPart): boolean;
```

`true` when the layer holds a single voxel at `position` and `part` fills the
rest of its cell, so a `merge` write would form a
[merged cell](../world/VoxelWorld.md#merged-cells). Blocks are resolved
through `document.blocks`, shapes through `shapes`.

```ts
const part = { blockId: kSlabTop, transform: 0 };
if (view.canMergeVoxelPart("Ground", position, part)) {
  view.document.world.setVoxel("Ground", { position, blockId: kSlabTop, merge: true });
}
```

A merged cell is drawn without the faces its two shapes share, unless the
shape in front is not opaque. A neighbour sees it as a full cube when both
shapes are opaque.

```ts
pickVoxelPart(layerName: string, position: THREE.Vector3Like, point: THREE.Vector3Like): VoxelPart | null;
```

The shape of the cell at `position` that contains `point`, given in world
space. A cell that is not merged returns its only shape wherever `point` is;
an empty cell or an unknown layer returns `null`.

A point on the surface between two shapes belongs to either. To find the shape
a raycast hit, step the hit point a little against the hit normal first, so it
lands inside the shape that owns the hit face:

```ts
const point = hit.point.clone().addScaledVector(hit.normal, -1e-4);
const part = view.pickVoxelPart("Ground", cell, point);
```

## Document changes

The view reacts to the document on its own:

- Voxel and layer commands remesh the affected chunks, plus the neighbouring
  chunks whose faces they can hide or reveal, in every layer.
- Block definitions and removals remesh the chunks holding the block, and their
  neighbours when culling can change. A definition that only moves its tiles
  (same blocksets and rotations, no blend group) or renames the block remeshes
  nothing: the chunks read the new tile rects on the next frame.
- Blockset commands update the atlases before other listeners run, then remesh
  every chunk.
- Material group changes update their materials; replacing a group remeshes
  every chunk.
- `loaded` clears every mesh and rebuilds the world.

## Chunk meshes

Each chunk cell gets one mesh per blockset and
[surface](../blocks/BlockSurface.md) (alpha mode, side, cutoff and material
group), under `root`.

- Layers positioned on a multiple of the chunk size share these meshes, so
  stacking layers adds no draw calls. A layer off the chunk grid gets its own.
- Faces touching a block of another [blend group](../materials/BlendGroup.md)
  go in a separate blended mesh.
- Opaque and masked surfaces write depth; blended ones do not. To composite
  overlapping transparent blocks, render the scene through a
  [`VoxelTransparencyPassNode`](./VoxelTransparencyPassNode.md).
- A blockset id containing `:surface=` makes mesh building throw `RangeError`.
- Meshes cast shadows from the faces they show, since hidden faces between
  blocks are never meshed. Give the light a `shadow.normalBias` of one to two
  shadow-map texels, in world units, or lit faces shadow themselves.
- Raycasts work, but the hits carry no `uv`.

### Material customizers

The vertex shader rebuilds every face from compact per-face data, so a
`rendering.customizer` must leave that path intact:

- The geometry has no `uv` attribute, and its `position` and `normal`
  attributes hold no positions or normals. Do not read them.
- Leave `positionNode` alone: it rebuilds the faces.
- Replacing `colorNode` drops tile sampling, ambient occlusion and distant tile
  filtering, and changes what the shadow pass draws.
- The material's `map` is `null`; the color node samples the atlas.

### Tile minification

Atlases are sampled nearest-neighbour without mipmaps, which would mix
neighbouring tiles.

- `"average"` (default) shows the average of the texels a pixel covers, within
  the face's own tile. Distant terrain stops shimmering and distant masked
  foliage fills in.
- `"nearest"` turns the filter off.
- Faces whose atlas pixels cannot be read, such as a cross-origin image without
  CORS or a `.ktx2` atlas, fall back to nearest sampling.
- The averages are recomputed on the next `tick()` after the atlas texture's
  `version` changes, for example through
  [`BlocksetAtlas.updateImage()`](../blocksets/BlocksetAtlas.md).

### Far distance

Past `range.farDistance` chunks from `focus`, a chunk draws each face in its
tile's flat average colour, and its blended blocks turn opaque.

- Only materials change, so crossing the threshold never remeshes.
- A chunk switches back half a chunk inside the threshold, so chunks on the
  border do not flicker.

### Normal maps

`loadBlockset(definition, texture, { normal })` adds a tangent-space normal
atlas.

- Same layout and size as the colour atlas, OpenGL convention: red points
  right and green points up in the image.
- Rotated, flipped and slanted faces need no extra data.
- Strength is the [`normalScale`](../materials/MaterialGroup.md) of the
  block's material group, `1` without a group; `0` turns it off.
- The relief fades with distance and is gone past `farDistance`. Shadows ignore
  it.
- Works with `"lambert"` and `"standard"`. Under `"standard"`, low roughness
  adds specular highlights on the relief.

### Ambient occlusion

`lighting.ambientOcclusion` darkens creases between blocks, up to `1`, where a
fully enclosed corner turns black. It is baked into the chunk meshes: no
post-processing pass, but chunk builds take about twice as long.

- Toggling it rebuilds every chunk; changing the strength does not.
- Only a block that fully covers one of its faces casts it, so cutout blocks
  and thin shapes such as poles cast none.
- Only faces on the cell boundary receive it: ramp slopes and the inner step of
  a stair stay lit.
- It multiplies the albedo, so it darkens direct and ambient light alike.
- An edit on a chunk edge or corner also rebuilds the diagonal chunks.

### Block light

A block whose [material group](../materials/MaterialGroup.md) has a
`lightLevel` lights its surroundings, Minecraft style: one level lost per cell,
so level 15 reaches 14 cells.

- It flows around opaque full cubes and through every other block (slabs,
  stairs, glass, cutout leaves).
- The colour is the group's `emissive` hue, or white when `emissive` is black.
  Each RGB channel spreads on its own, so coloured lights mix, and the weaker
  channels fade out first.
- `lighting.blockLight` scales it; `0` hides it and pauses updates until the
  strength rises again.
- It adds to the scene lights, so it shows best in a dark scene. A standard
  material receives it as ambient light, so metal reflects it instead of going
  dark.
- Light fades smoothly across faces and does not leak through one-block walls.
- Sun shadows do not dim it; ambient occlusion does.
- The material's `emissive` output holds only the glow of the emitting block,
  see [selective bloom](./VoxelTransparencyPassNode.md#selective-bloom).

Cost:

- Computed on the CPU, never saved or sent to peers. An edit relights only the
  chunks within reach of a light; a world without glowing groups skips the
  work.
- Each lit chunk gets a small light texture (about 23 KB for 16-cell chunks).
  A light change re-uploads it without rebuilding the mesh.

`lighting.blockLightFalloff` picks the curve (brightness next to the source, 3
and 8 cells away):

- `"wide"` (default): `0.82`, `0.57`, `0.23`. Every cell in range is lit
  almost evenly.
- `"focused"`: `1.38`, `0.39`, `0.04`. A lamp with a pool of light around it;
  values above 1 rely on tone mapping.

Changing the falloff rewrites every lit chunk's light texture. Only coloured
lights are relit, since their channel levels depend on the curve.

Block light adds to a shadowed surface without replacing the missing sunlight,
so a sun shadow still shows next to a glowing block. `lighting.shadowFill`
washes it out where block light is strong: `0` keeps shadows whole, `1`
removes them where block light is at full brightness.
