# VoxelInspector

`VoxelEngine.inspector` exposes a `VoxelInspector`: live mesh statistics, block
statistics read from the world, an optional wireframe view of the geometry the
mesh builder produced, and an outline of every chunk boundary.

```ts
import { VoxelEngine } from "@jolly-pixel/voxel.renderer";

const engine = new VoxelEngine({ layers: ["Ground"] });

// Draw the wireframe over the textured chunks.
engine.inspector.mode = "overlay";

const { faces, culledFaces, triangles } = engine.inspector.mesh.stats;
console.log(`${faces} faces, ${culledFaces} culled, ${triangles} triangles`);

const { voxels, unusedBlocks } = engine.inspector.blocks.stats;
console.log(`${voxels} voxels, ${unusedBlocks.length} unused blocks`);
```

Mesh counters are collected on every chunk build, whatever the mode; only the
wireframe has an additional rendering cost.

## API

```ts
class VoxelInspector {
  mode: VoxelInspectorMode;
  enabled: boolean;
  chunkBounds: boolean;
  readonly mesh: VoxelMeshInspector;
  readonly blocks: VoxelBlockInspector;
  readonly metrics: readonly VoxelMetric[];

  constructor(
    context: VoxelInspectorContext,
    options?: VoxelInspectorOptions
  );
  nextMode(): VoxelInspectorMode;
  registerChunk(
    key: string,
    meshes: readonly THREE.Mesh[],
    stats: MeshBuildStats,
    bounds?: InspectedChunkBounds | null
  ): void;
  unregisterChunk(key: string): void;
  clear(): void;
  dispose(): void;
}

interface VoxelInspectorContext {
  parent: THREE.Object3D;
  world: VoxelWorld;
  blockRegistry: BlockRegistry;
}

interface VoxelMeshInspector {
  readonly stats: VoxelMeshStats;
}

interface VoxelMetric {
  id: string;
  label: string;
  unit?: "count" | "decimal" | "ms" | "percent";
  better?: "higher" | "lower";
  group?: string;
  tile?: boolean;
  sample(): number;
}

interface InspectedChunkBounds {
  readonly origin: Readonly<THREE.Vector3Like>;
  readonly size: number;
}
```

`VoxelEngine` builds its inspector with its own `root`, `world` and
`blockRegistry`; the view groups are attached under `parent`.

`registerChunk()` copies the supplied statistics. Re-registering a key replaces
its meshes and counters. `unregisterChunk()` ignores unknown keys. `clear()`
removes all tracked chunks, overlays and boundary boxes; `dispose()` also
releases the inspector materials and the boundary geometry. `bounds` is copied
when registered; a chunk registered without it is still counted but never
outlined.

## Modes

| Mode | Effect |
|---|---|
| `"off"` (default) | chunks render normally, nothing is added to the scene graph |
| `"overlay"` | a wireframe copy is drawn over the textured chunks |
| `"wireframe"` | the textured chunks are hidden, leaving only the wireframe |

Wireframes reuse the chunk geometries. Switching modes never re-meshes
anything and costs no extra vertex memory, only one draw call per chunk mesh.
While a mode other than `"off"` is active, a `THREE.Group` named
`"VoxelInspector"` holds them under `engine.root`.

```ts
// Cycle off → overlay → wireframe → off, e.g. from a keybinding.
document.addEventListener("keydown", (event) => {
  if (event.code === "KeyG") {
    engine.inspector.nextMode();
  }
});

// Booleans work too: `enabled = true` selects "overlay".
engine.inspector.enabled = false;
```

The initial state comes from `VoxelEngineOptions.inspector`:

```ts
interface VoxelInspectorOptions {
  /** @default "off" */
  mode?: VoxelInspectorMode;
  /** @default 0x66FF99 */
  color?: THREE.ColorRepresentation;
  /** Wireframe opacity, `1` disables blending. @default 0.5 */
  opacity?: number;
  /** Outlines every registered chunk. @default false */
  chunkBounds?: boolean;
  /** @default 0xFF3B30 */
  chunkBoundsColor?: THREE.ColorRepresentation;
}
```

## Chunk bounds

`chunkBounds` outlines the boundary of every registered chunk. It is
independent of `mode`: the outlines show over normally rendered chunks, over
the wireframe overlay, or on their own.

```ts
const engine = new VoxelEngine({
  layers: ["Ground"],
  inspector: { chunkBounds: true }
});

// Or at any time.
engine.inspector.chunkBounds = true;
```

Each box is a `THREE.LineSegments` sharing one unit-cube edge geometry and one
material, positioned on the chunk origin and scaled to the chunk size, so the
cost is a draw call per chunk and nothing else. They live in a `THREE.Group`
named `"VoxelInspector:chunkBounds"` under `engine.root`, attached only while
the flag is on.

A box follows the chunk it outlines. A chunk hidden by the
[view distance](../world/ViewDistance.md) under the `"hide"` policy loses its
box until it comes back, and one disposed under `"unload"` loses it with the
mesh, so the outlines never outlive what they wrap. A chunk that produced no
geometry is outlined, so allocated but empty chunks stay visible.

The lines are drawn with `depthTest: false` and a high `renderOrder`. Chunk
edges are coplanar with the voxel faces on the border, and most boxes sit
inside solid terrain, so depth-tested lines would z-fight and stay invisible
underground.

## Mesh statistics

`inspector.mesh.stats` sums the last build of every retained chunk, so it
follows chunk rebuilds, layer removals and `load()` without ever being stale.
It describes what was meshed: chunks not built yet, or unloaded by the view
distance, are missing from it. Use [block statistics](#block-statistics) to
count what the world stores.

```ts
interface VoxelMeshStats {
  /** Chunks the mesh builder processed, including those emitting no face. */
  chunks: number;
  /** Chunks hidden by the view distance; counted in every total above. */
  culledChunks: number;
  /** Chunk meshes attached to the scene graph, i.e. one draw call each. */
  meshes: number;
  /** Voxels visited. */
  voxels: number;
  /** Voxels skipped because a higher-priority layer covers the position. */
  hiddenVoxels: number;
  /** Faces written to a geometry. */
  faces: number;
  /** Faces skipped because an opaque neighbour occludes them. */
  culledFaces: number;
  /** Voxel faces greedy meshing folded into a neighbour's quad; 0 when off. */
  mergedFaces: number;
  vertices: number;
  triangles: number;
  /** faces / (voxels - hiddenVoxels). */
  facesPerSolidVoxel: number;
  /** Vertex attributes emitted, in bytes per vertex; indices excluded. */
  bytesPerVertex: number;
  /** Sum of the last build time of every live chunk, not a frame cost. */
  buildTimeMs: number;
}
```

`faces + culledFaces` is the number of face candidates, which makes the culling
ratio directly readable:

```ts
const { faces, culledFaces } = engine.inspector.mesh.stats;
const ratio = (culledFaces / (faces + culledFaces)) * 100;
```

With [greedy meshing](../../concepts/rendering-and-meshing.md#greedy-meshing) on,
`faces` counts quads
rather than voxel faces, and `mergedFaces` is how many extra voxel faces those
quads absorbed. `faces + mergedFaces` is therefore what the naive builder would
have emitted, which makes the merge ratio readable the same way:

```ts
const { faces, mergedFaces } = engine.inspector.mesh.stats;
const ratio = (mergedFaces / (faces + mergedFaces)) * 100;
```

The two derived figures are the ones worth watching for regressions:

- `facesPerSolidVoxel` should decrease when greedy meshing combines faces. If it
  does not, inspect the merge predicates and the blocks in the measured chunks.
- `bytesPerVertex` is read off the emitted geometries, not off a constant, so an
  attribute that quietly widens (or a dropped one that comes back) shows up here
  with no code change needed. The current layouts report 19 without greedy
  meshing and 35 with it. `tileRegion`, `tileRepeat`, and float tile UVs account
  for the difference.

`MeshBuildStats` holds the counters for a single chunk build. `VoxelInspector`
keeps a copy per chunk key and aggregates them on demand.

```ts
class MeshBuildStats {
  voxels: number;
  hiddenVoxels: number;
  faces: number;
  culledFaces: number;
  mergedFaces: number;
  vertices: number;
  triangles: number;
  geometries: number;
  bytesPerVertex: number;
  buildTimeMs: number;

  readonly facesPerSolidVoxel: number;

  reset(): void;
  copyFrom(source: MeshBuildStats): void;
  clone(): MeshBuildStats;
}
```

All counters start at `0`. `facesPerSolidVoxel` is `faces` divided by
`voxels - hiddenVoxels`; it returns `0` when no voxel contributed geometry.
`reset()` clears the instance. `copyFrom()` replaces every field with another
instance's counters, and `clone()` returns an independent copy.

## Metrics

`inspector.metrics` describes the same counters as metric definitions a
performance recorder can sample, so a host displays them without restating a
label, a unit or a derived ratio.

```ts
runtime.metrics.addSource(engine.inspector);
```

`VoxelMetric` is declared by this package and matched structurally, so nothing
here depends on a UI library. It is compatible with `MetricDefinition` of
`@jolly-pixel/ui/stats`, which `test/inspector/VoxelMetric.tst.ts` pins.

| Metric | Unit | Value |
|---|---|---|
| `chunks` | count | `mesh.stats.chunks` |
| `meshes` | count | `mesh.stats.meshes` |
| `voxels` | count | `mesh.stats.voxels` |
| `faces` | count | `mesh.stats.faces` |
| `meshTriangles` | count | `mesh.stats.triangles` |
| `culledFaces` | percent | culled share of every candidate face |
| `mergedFaces` | percent | merged share of every emitted face |
| `facesPerVoxel` | decimal | `mesh.stats.facesPerSolidVoxel` |
| `buildTimeMs` | ms | `mesh.stats.buildTimeMs` |

The two shares are the ratios described above, and are `0` before anything is
built. Every metric samples the live statistics, so one registration keeps
following rebuilds. They are filed under the `voxel` group and set
`tile: false`, which keeps them in a full readout rather than in a HUD
cycling one metric at a time.

## Block statistics

`inspector.blocks` reads the voxels stored in `engine.world` and joins them
with `engine.blockRegistry`. Results are computed on each call and follow
edits, remote commands and `load()` immediately, with no rebuild needed.

```ts
class VoxelBlockInspector {
  readonly stats: VoxelBlockStats;

  constructor(options: {
    world: VoxelWorld;
    blockRegistry: BlockRegistry;
  });
  usageOf(blockId: number): VoxelBlockUsage;
  tilesetUsageOf(tilesetId: string): VoxelTilesetUsage;
}

interface VoxelBlockStats {
  voxels: number;
  layers: VoxelLayerBlockStats[];
  blocks: Map<number, number>;
  unusedBlocks: number[];
  orphanBlocks: number[];
  orphanVoxels: number;
}

interface VoxelLayerBlockStats {
  layerName: string;
  voxels: number;
  chunks: number;
}

interface VoxelBlockUsage {
  blockId: number;
  voxels: number;
  layers: Array<{ layerName: string; voxels: number; }>;
}

interface VoxelTilesetUsage {
  tilesetId: string;
  blocks: number[];
  voxels: number;
}
```

| Field | Meaning |
|---|---|
| `voxels` | voxels stored in every layer |
| `layers` | voxel and chunk count per layer, in `world.getLayers()` order |
| `blocks` | voxel count per stored block id, orphans included |
| `unusedBlocks` | registered ids no voxel uses, in registry order |
| `orphanBlocks` | stored ids missing from the registry, ascending |
| `orphanVoxels` | voxels whose block id is in `orphanBlocks` |

Stored voxels are counted, not rendered ones: hidden layers, faded layers and
voxels covered by a `"replace"` layer all count. The mesh `hiddenVoxels`
counter gives the rendered side.

`usageOf()` lists only the layers holding the block, and returns `voxels: 0`
with no layer for an unused or unknown id. It is the number to show before
removing a block definition, since `block-removed` leaves its voxels in place
as orphans.

`tilesetUsageOf()` lists the registered blocks with at least one tile in the
tileset (face textures or default texture), and the voxels of those blocks.
A block spanning two tilesets counts toward both.

```ts
const { voxels, layers } = engine.inspector.blocks.usageOf(blockId);
if (voxels > 0) {
  console.warn(`Block used by ${voxels} voxels in ${layers.length} layers`);
}
```

Counting relies on a per-chunk histogram cached against `VoxelChunk.revision`,
so a query after an edit only rescans the chunks that changed. The world-side
counters are also available directly; see
[`VoxelWorld`](../world/VoxelWorld.md#block-counts).

## Example

`examples/noise-world.html` wires all three to its HUD: `G` cycles the
wireframe modes, a `chunk bounds` checkbox toggles the outlines, and the mesh
counters reach the panel through `runtime.metrics.addSource()`, refreshed four
times per second.

```bash
pnpm --filter @jolly-pixel/voxel.renderer dev
```
