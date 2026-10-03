# VoxelInspector

Debug views and statistics of a [`VoxelView`](./VoxelView.md), exposed as
`view.inspector`: a wireframe of the meshed chunks, chunk outlines, mesh
counters and block usage.

```ts
view.inspector.mode = "overlay";
view.inspector.chunkBounds = true;

const { faces, culledFaces, triangles } = view.inspector.mesh.stats;
const { voxels, unusedBlocks } = view.inspector.blocks.stats;
```

## Options

Passed as `VoxelViewOptions.inspector`.

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `"off"` | Initial [mode](#modes). |
| `color` | `0x66FF99` | Wireframe colour. |
| `opacity` | `0.5` | Wireframe opacity; `1` disables blending. |
| `chunkBounds` | `false` | Outline every chunk. |
| `chunkBoundsColor` | `0xFF3B30` | |

## Properties

```ts
mode: "off" | "overlay" | "wireframe";
enabled: boolean;
chunkBounds: boolean;
readonly mesh: { readonly stats: VoxelMeshStats };
readonly blocks: VoxelBlockInspector;
readonly metrics: readonly VoxelMetric[];

nextMode(): VoxelInspectorMode;
```

## Modes

| Mode | Effect |
| --- | --- |
| `"off"` | Chunks render normally. |
| `"overlay"` | A wireframe is drawn over the textured chunks. |
| `"wireframe"` | Only the wireframe is drawn. |

Switching modes never remeshes. `nextMode()` cycles through the three and
returns the new mode. `enabled = true` selects `"overlay"`, `false` selects
`"off"`.

`chunkBounds` outlines each meshed chunk, independently of `mode`. The outlines
are drawn on top of the scene and follow chunks hidden or unloaded by the
[view distance](../world/ViewDistance.md).

## Mesh statistics

`mesh.stats` sums the last build of every meshed chunk. Chunks not built yet,
or unloaded by the view distance, are not counted.

| Field | Description |
| --- | --- |
| `chunks` | Chunks meshed, including those with no face. |
| `culledChunks` | Of those, chunks hidden by the view distance. |
| `meshes` | Chunk meshes in the scene, one draw call each. |
| `voxels` | Voxels visited. |
| `hiddenVoxels` | Voxels covered by a higher layer. |
| `faces` | Faces drawn. |
| `culledFaces` | Faces hidden by an opaque neighbour. |
| `vertices`, `triangles` | |
| `facesPerSolidVoxel` | `faces / (voxels - hiddenVoxels)`; `0` when nothing was drawn. |
| `bytesPerVertex` | Vertex attribute bytes per vertex, indices excluded. |
| `bytes` | GPU memory of the chunk geometries. |
| `buildTimeMs` | Sum of each chunk's last build time, not a frame cost. |

## Metrics

`metrics` lists the same counters as metric definitions for a performance
recorder. `VoxelMetric` is compatible with `MetricDefinition` from
`@jolly-pixel/ui/stats`.

```ts
runtime.metrics.addSource(view.inspector);
```

| Metric | Unit | Value |
| --- | --- | --- |
| `chunks` | count | `mesh.stats.chunks` |
| `meshes` | count | `mesh.stats.meshes` |
| `voxels` | count | `mesh.stats.voxels` |
| `faces` | count | `mesh.stats.faces` |
| `meshTriangles` | count | `mesh.stats.triangles` |
| `culledFaces` | percent | `culledFaces / (faces + culledFaces)`, `0` before any build |
| `facesPerVoxel` | decimal | `mesh.stats.facesPerSolidVoxel` |
| `meshMemory` | bytes | `mesh.stats.bytes` |
| `buildTimeMs` | ms | `mesh.stats.buildTimeMs` |

All metrics are in the `voxel` group with `tile: false`.

## Block statistics

`blocks` counts the voxels stored in `document.world` per block, including
hidden layers and covered voxels. Results are computed on each call.

```ts
readonly stats: VoxelBlockStats;
usageOf(blockId: number): VoxelBlockUsage;
tilesetUsageOf(tilesetId: string): VoxelTilesetUsage;
```

| `stats` field | Description |
| --- | --- |
| `voxels` | Voxels stored in every layer. |
| `layers` | `{ layerName, voxels, chunks }` per layer, in `world.getLayers()` order. |
| `blocks` | `Map` of voxel count per stored block id, orphans included. |
| `unusedBlocks` | Registered ids no voxel uses, in registry order. |
| `orphanBlocks` | Stored ids missing from the registry, ascending. |
| `orphanVoxels` | Voxels whose block is in `orphanBlocks`. |

`usageOf()` returns `{ blockId, voxels, layers }`, listing only the layers that
hold the block. Check it before removing a block: `block-removed` leaves the
voxels in place as orphans.

```ts
const { voxels, layers } = view.inspector.blocks.usageOf(blockId);
if (voxels > 0) {
  console.warn(`Block used by ${voxels} voxels in ${layers.length} layers`);
}
```

`tilesetUsageOf()` returns `{ tilesetId, blocks, voxels }`: the registered
blocks with at least one tile in the tileset, and their voxel count. A block
using two tilesets counts toward both.
