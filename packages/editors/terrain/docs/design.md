# Design

The V1 decisions and the data they produce. How edits travel between users is
in [collaboration](./collaboration.md); how brushes write is in
[brush](./brush.md); how the surface is shaded is in [texture](./texture.md).

## Decisions

| Topic | Decision |
|---|---|
| Scale | Large streamed worlds, 10 km² and more. Chunks are created on demand; there is no predetermined vertex map. |
| Surface | 2.5D heightfield with a hole mask. Cave interiors are separate assets. |
| Grid | Regular square grid, alternating diagonals. |
| Detail | Resolution tiers per chunk: ×1, ×2 or ×4. |
| Far LoD | CDLOD quadtree, an always-resident overview map, and points of interest. |
| Splat | Index and weight maps over texture arrays. |
| Techniques | Per-layer flags: triplanar, stochastic tiling, height blending. |
| Rooms | One room per terrain asset. Commands are keyed by chunk. |
| Streaming | Asset parts in the asset server, loaded by interest. |

## World and chunks

The world is a sparse grid of chunks, 64 m on a side. Chunk `(x, z)` covers
`[x × 64, (x + 1) × 64)` on X and the same on Z. A chunk exists only once
someone creates it, by adding it next to an existing one or by sculpting
across an edge. Removing a chunk deletes its data. A new terrain starts with
one flat chunk at `(0, 0)`, and removing the last chunk is refused.

Each sample belongs to exactly one chunk: chunk `(x, z)` owns the samples in
`[x × 64, (x + 1) × 64)` on X and Z, and the row and column at `(x + 1) × 64`
belong to its neighbours. No sample is stored twice, so an edit on an edge
writes it once. A new chunk starts with its edge samples copied from the
chunks next to it, so adding one never opens a cliff.

Heights are clamped to `[-4096, 4096]` m.

## Grid

Heights are a regular grid with `2^n × 2^n` samples per chunk. At the base
spacing of 1 m that is 64×64, or 4×4 tiles of 16×16.

Each quad is split into two triangles, and the diagonal alternates from one
quad to the next in a diamond pattern:

```
+---+---+---+---+
| \ | / | \ | / |
+---+---+---+---+
| / | \ | / | \ |
+---+---+---+---+
```

This is the 4-8 pattern most engines use. It removes the directional bias a
fixed diagonal gives to ridges and valleys, and it is the pattern longest-edge
bisection produces, so [tessellation](#future-tessellation) can continue it.
LoD level `k + 1` keeps every second sample of level `k` and the same pattern,
so levels nest exactly.

Normals come from the height texture, by finite differences per pixel, not
from the triangles. Lighting is the same whatever the split.

The trade-off: vertices come in two classes, linked to 4 or to 8 neighbours.
Raising a single sample gives a slightly different silhouette depending on
which class it belongs to. A brush with a falloff moves many samples, so the
difference does not show in practice.

Other triangulations were compared:

| Triangulation | Rejected because |
|---|---|
| Fixed diagonal | Ridges look sharp along one diagonal and jagged along the other. |
| Centre vertex per quad, as in WoW | About twice the data; centre samples do not halve into LoD levels. |
| Diagonal chosen per quad from the heights | Not engine-standard, and does not continue into bisection tessellation. |

The split rule lives in one function, `quadDiagonal(x, z)`. The node meshes,
the brush ray cast, height queries, and later colliders and exports all call
it, so what is drawn, aimed at and walked on agree, and the rule can change in
one place.

## Resolution tiers

WebGPU has no tessellation stage, so extra detail is stored, not generated. A
chunk can be refined to ×2 (128², 0.5 m) or ×4 (256², 0.25 m). Brushes then
edit the finer grid, and the quadtree has extra levels over that chunk.

Refining a chunk resamples its heights bilinearly, so the surface does not
move. Coarsening keeps every second or fourth sample and loses the detail in
between. The edge shared with a coarser neighbour has to match it, which is
done with morphing (see below), not by changing the data.

## LoD

The view uses CDLOD:

- The world is split into regions of 16×16 chunks, 1024 m on a side and
  aligned to the chunk grid. Each region that holds a chunk has its own
  quadtree, which picks nodes by distance to the camera.
- A leaf node covers 32 m, a quarter of a chunk, and the root covers the
  region: six levels from 32 m to 1024 m. A ×2 chunk adds one level under its
  leaves, a ×4 chunk two.
- Leaves are drawn within 80 m of the camera, and each coarser level doubles
  that range. A node is refined when its children's range reaches its bounds,
  which span the heights of the chunks under it. Where only some children are
  in range, the other quarters are drawn at the node's own level, so
  neighbouring nodes never differ by more than one level.
- Every node draws the same 33×33 grid mesh, 32 quads, so a leaf draws at full
  1 m detail. The vertex shader reads the heights from the chunk's height
  texture. The mesh comes from a `NodeMeshProvider`, so a tessellated mesh can
  replace the grid later.
- Near the boundary of a level, vertices morph toward the coarser level's
  positions, so levels meet without cracks or popping. The morph runs over
  the last 30% of each level's distance band.
- Skirts hang under chunk edges and hide what morphing cannot.

### Slope overlay

An overlay colours the surface by slope, on a ramp from 0° to 60° and above,
and highlights everything steeper than a maximum walkable angle, 45° by
default. The angle comes from the same finite-difference normal as the
lighting. The overlay and the angle are view settings.

### Overview map

A coarse height and colour map of the whole world, one sample per 32 m, always
in memory. Nodes beyond the stream radius draw from it, so the horizon is
never empty. It is rebuilt incrementally from the chunks that change.

### Points of interest

A point of interest is a volume placed by a designer, such as a mountain seen
from far away. It has:

- an LoD bias, so its chunks are refined earlier than distance alone would;
- a minimum detail level kept at any distance;
- a priority for streaming its chunks in.

Points of interest are part of the asset.

## Future tessellation

Not in V1, but the design keeps room for it. WebGPU has no tessellation
stage; the way to get one is subdivision in compute shaders, such as
concurrent binary trees: triangles are split by longest-edge bisection,
according to distance, screen error or curvature, and drawn with one indirect
draw. New vertices sample the height texture, and each layer can add
displacement from its height map.

Resolution tiers give detail that can be sculpted. Tessellation would add
automatic detail near the camera. The two stack.

What V1 keeps for it:

- Node meshes come from a `NodeMeshProvider`.
- Layers have a `displacementScale`, 0 and unused in V1.
- Heights, holes and splat are textures. Brushes, height queries and exports
  read the data, never the mesh.

To check before starting: compute and indirect draw support in three.js's
`WebGPURenderer`.

## Holes

One bit per base-grid quad marks a hole. On a refined chunk, holes follow the
finer grid.

- The fragment shader discards hole cells. Near levels also drop them from the
  index buffer.
- A coarse LoD cell is dropped when any quad under it is a hole.
- Heights and splat under a hole are kept. Filling the hole brings the surface
  back as it was.

Accepted drawbacks:

- Openings are blocky: 1 m quads, or 0.5 m and 0.25 m on refined chunks. A
  cave entrance mesh is expected to cover the rim.
- Far away, a hole looks slightly larger, because of the coarse-cell rule.
- Normals and skirts along the rim need care to avoid light leaks.
- Colliders have to honor the mask once physics arrives.

## Data per chunk

| Channel | Format | Size at ×1 |
|---|---|---|
| Heights | `Float32`, one per sample | 64×64 |
| Splat indices | `RGBA8`: the four strongest layers | 128×128, 0.5 m per texel |
| Splat weights | `RGBA8`: their weights, summing to 255 | 128×128 |
| Holes | One bit per quad | 64×64 |
| Tier | 1, 2 or 4 | One value |

Tiers multiply the height and hole sizes. The splat resolution does not
change with the tier.

On the GPU each chunk has an `R32F` height texture, two `RGBA8` splat textures
and an `R8` hole texture. Edits upload only the changed rectangle.

The height texture is 66×66 at ×1: the chunk's own samples plus a one-sample
apron on every side, copied from the neighbours. The apron gives the mesh its
last row and column and gives the normals their neighbours across the edge.
An edit on an edge tile also uploads the matching strip of the neighbour's
apron. Where no neighbour exists, the apron repeats the chunk's outer row,
which leaves a flat 1 m strip along the edge of the world.

## Packages

### `@jolly-pixel/asset.terrain`

`packages/assets/terrain`, laid out like `packages/assets/voxel-map`:

- `src/asset/`: the kind, its descriptor and builders in `terrain.ts`; the
  state, decoder and kind handler in `terrainAssetKind.ts`.
- `src/network/`: `TerrainCommand.schema.ts`, `TerrainCommandArbiter.ts`,
  `TerrainCommandKeys.ts`, `TerrainCorrection.ts`, `TerrainReconciler.ts`,
  `TerrainSyncClient.ts`.
- `src/history/`: the `CommandHistory` registration.

### `@jolly-pixel/terrain.renderer`

`packages/terrain-renderer`, laid out like `packages/voxel-renderer`:

- `src/document/`: `TerrainDocument`, `TerrainChunk`, `ChunkGrid`,
  `OverviewMap`, `PointOfInterest`. Headless; runs in Node.
- `src/view/`: `TerrainView`, quadtree selection, `ChunkTextureStore`, the
  streaming budget.
- `src/view/shading/`: TSL nodes for height sampling, morphing, splat, holes
  and debug overlays.
- `src/plugins/engine/`: the `TerrainRenderer` component, so a game renders
  terrain without the editor.
- `src/io/`: heightmap and splat map import and export, 16-bit PNG and RAW.

### `@jolly-pixel/editor.terrain`

This package, laid out like the voxel-map editor:

- `boot/`, `document/`, `state/`, `scene/`, `shell/`, `shared/`.
- `features/{sculpt,paint,holes,layers,tiers,poi,overlays,importExport}/`,
  each split into `model/`, `interaction/`, `rendering/`, `toolbar/` and
  `collaboration/` as needed.
