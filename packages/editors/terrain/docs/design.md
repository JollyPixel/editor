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
| Techniques | Per-material flags: triplanar, stochastic tiling, height blending. |
| Rooms | One room per terrain asset. Commands are keyed by chunk. |
| Streaming | Asset parts in the asset server, loaded by interest. |

## World and chunks

The world is a sparse grid of chunks, 64 m on a side. Chunk `(x, z)` covers
`[x × 64, (x + 1) × 64)` on X and the same on Z. A chunk exists only once
someone adds it with the Chunks tool, next to an existing one; see
[Chunks tool](./brush.md#chunks-tool). Brushes never create chunks. Removing a
chunk deletes its data. A new terrain starts with
one flat chunk at `(0, 0)`, and removing the last chunk is refused.

Chunk coordinates lie in `[-128, 127]` on each axis, 16 km per side, so the
view's 256×256 lookup texture never gives two chunks the same slot. A terrain
holds at most 4096 chunks (`MAX_TERRAIN_CHUNKS`), about 17 km², while the
server keeps every part in memory: 64 MB of heights at ×1, and a join
snapshot of about 200 KB.

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

The split rule lives in one function, `quadDiagonal(x, z)`: quad `(x, z)`
takes the `main` diagonal, from `(x, z)` to `(x + 1, z + 1)`, when `x + z` is
even, and the `anti` diagonal otherwise. The node meshes,
the brush ray cast, height queries, and later colliders and exports all call
it, so what is drawn, aimed at and walked on agree, and the rule can change in
one place.

## Resolution tiers

WebGPU has no tessellation stage, so extra detail is stored, not generated. A
chunk can be refined to ×2 (128², 0.5 m) or ×4 (256², 0.25 m). Brushes then
edit the finer grid, and the quadtree has extra levels over that chunk.

Refining a chunk does not move the surface. It doubles the grid once or
twice: a new sample on an edge takes the mean of the edge's two ends, and one
at a quad's centre the mean of the ends of that quad's diagonal, so the new
samples lie on the triangles drawn before. Samples past the far edge come
from the neighbours' heights. Coarsening keeps every second or fourth sample
and loses the detail in between. The edge shared with a coarser neighbour has to match it, which is
done with morphing, not by changing the data: on a chunk's west and south
edges, where the neighbour across has a coarser tier, the vertex shader reads
the edge along the neighbour's grid, interpolating between its samples, so
the finer side draws the same straight segments as the coarser one. The east
and north edges belong to the neighbour, whose samples a finer node reads
the same way.

A tier is set from the Detail mode of the [Chunks tool](./brush.md#chunks-tool).
The command carries the heights and holes it replaced, so undoing a
coarsening brings the detail back exactly. A ×4 chunk puts 256 KB of heights
in that undo step.

The view keeps one height array and one hole array per tier, each with its own
pool of layers, and the lookup texture also gives each chunk's tier. Memory
follows the tiers in use: an unrefined terrain allocates nothing for ×2 and
×4, whose arrays start with four layers and double as chunks are refined. The
splat array keeps one layer per loaded chunk whatever its tier.

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
  the last 30% of each level's distance band. The levels under the leaves of
  a refined chunk, 16 m and 8 m nodes, are drawn within 40 m and 20 m.
- Morphing moves heights, not positions. A vertex the coarser level drops
  keeps its X and Z and blends toward the average height of two neighbours:
  the ends of the coarse edge it sits on, or, for the centre of a coarse
  quad, the ends of that quad's diagonal. Fully morphed, the mesh lies on the
  coarser level's triangles, which the alternating diagonals require: sliding
  vertices onto their neighbours only works with a fixed diagonal.
- Node and quarter-node corners fall on even grid lines, so one mesh per
  resolution serves every node: 32 quads for a node, 16 for a quarter.
- Skirts hide the hairline cracks that rounding leaves where two levels meet.
  A node only has them on edges that face a node of another level, one grid
  spacing deep, and they collapse where no chunk lies across the edge, so the
  world's border ends cleanly.
- A node can cover ground with no chunk; its fragments there are discarded.
  Chunk borders fall on vertex lines at every level, so no triangle straddles
  one.

### Debug overlays

`TerrainView.overlay` switches the surface between `none`, `chunks`, which
draws a one-pixel line on every chunk border, `lod`, which adds a tint per
LoD level, `slope`, described below, `splat`, described in
[texture](./texture.md#overlays), and `holes`, which draws hole cells instead
of discarding them; `revealHoles` does the same over any other mode, and
`revealChunks` draws the chunk borders over any other mode. Uniforms
select the mode, so switching does not recompile the shader.

### Slope overlay

An overlay colours the surface by slope, on a ramp from 0° to 60° and above,
and highlights everything steeper than a maximum walkable angle, 45° by
default. The angle comes from the same finite-difference normal as the
lighting. The overlay and the angle are view settings: `TerrainView.overlay`
and `TerrainView.walkableSlope`, in degrees from 0 to 90, set from the
editor's overlay toolbar and saved in the browser. The ramp runs from
green on flat ground through yellow to orange at 60°; steeper than the
walkable angle is red.

### Overview map

A coarse height and colour map of the whole world, one sample per 32 m, always
in memory. Nodes beyond the stream radius draw from it, so the horizon is
never empty. It is rebuilt incrementally from the chunks that change.

- A sample is the height at a 32 m grid point, not an average. These are the
  vertices a 1024 m root node draws, so a far node looks the same drawn from
  the overview or from its chunks.
- A chunk owns the 2×2 samples at local `(0, 0)`, `(32, 0)`, `(0, 32)` and
  `(32, 32)`, as it owns its heights. Adding, removing or writing a chunk
  updates its own samples and no other.
- `Terrain.overview` holds them. The asset file and the room snapshot
  list each chunk's samples, so a client knows the far terrain without loading
  its chunks; loading a chunk derives its samples from its heights.
- Each sample also holds a dominant material: the slot with the highest weight
  in the splat texel at its grid point, one byte. The view colours it with
  that material's mean albedo, so changing a material's image recolours the horizon
  without changing the data, and the server never decodes an image.
- A vertex or fragment on an unloaded chunk reads the overview, interpolated
  bilinearly between its four nearest samples; on a loaded chunk it reads the
  chunk's heights. The height is a function of position only, so two nodes
  sharing an edge always agree and no crack opens where loaded ground meets
  unloaded ground. A chunk's apron reads an unloaded neighbour the same way.
- The view keeps the overview in one 512×512 `R32F` texture, two texels per
  chunk on each axis, indexed by chunk coordinates modulo 256 like the
  lookup texture. The lookup marks each known chunk, loaded or not; fragments
  on unknown ground are discarded.
- The quadtree covers every known chunk. An unloaded chunk's node bounds span
  its overview samples and those of the chunks east, north and north-east of
  it, which bound the interpolated surface.

### Points of interest

A point of interest is a set of chunks picked by a designer, such as a
mountain seen from far away. It has:

- a name;
- an LoD bias, a factor from 1 to 8, 2 by default, that multiplies the LoD
  distance bands over its chunks, so they are refined earlier than distance
  alone would;
- a minimum detail level kept at any distance, from 0 (the 32 m leaf) to 5
  (the 1024 m region root), 3 by default (256 m nodes);
- a priority for streaming its chunks in, from 0 to 9, 0 by default, the
  highest first.

A chunk can belong to several points of interest; the largest bias, the
finest minimum level and the highest priority apply.

The stream keeps the chunks of every point of interest loaded at any
distance, so the minimum level is drawn from their heights, not from the
overview. They fill the layers the stream circle leaves free, highest priority
first and nearest first within a priority; a chunk that finds no free layer
falls back to the overview. The circle's share counts every known chunk out to
the unload radius, loaded or not, so the camera moving never needs more than
the 256 layers. A chunk takes the highest priority of the points of interest
naming it, and the choice is made again whenever the camera enters another
chunk or a point of interest changes.

The Points of interest pane lists them with their settings. Selecting one
tints its chunks, and its "Edit chunks" toggle lets a click or drag add
chunks to it, Ctrl+click remove them.

Points of interest are part of the asset: the manifest lists them, at most
64, each with its chunks, and the join snapshot carries them to every member.
A point of interest may name chunks that do not exist, such as ones removed
since; they are skipped wherever its chunks are used.

## Future tessellation

Not in V1, but the design keeps room for it. WebGPU has no tessellation
stage; the way to get one is subdivision in compute shaders, such as
concurrent binary trees: triangles are split by longest-edge bisection,
according to distance, screen error or curvature, and drawn with one indirect
draw. New vertices sample the height texture, and each material can add
displacement from its height map.

Resolution tiers give detail that can be sculpted. Tessellation would add
automatic detail near the camera. The two stack.

What V1 keeps for it:

- Node meshes come from a `NodeMeshProvider`.
- Materials have a height map and a `displacementScale`, 0 and unused in V1.
- Heights, holes and splat are textures. Brushes, height queries and exports
  read the data, never the mesh.

To check before starting: compute and indirect draw support in three.js's
`WebGPURenderer`.

## Holes

One bit per base-grid quad marks a hole. On a refined chunk, holes follow the
finer grid.

- The fragment shader discards hole cells. Near levels could also drop them
  from the index buffer; V1 does not.
- A coarse LoD cell is dropped when any quad under it is a hole. The view
  uploads each chunk's mask as a max pyramid, 128×64 bytes per layer, so the
  test is one texture read at the cell size of the node's spacing.
- Heights and splat under a hole are kept. Filling the hole brings the surface
  back as it was.
- Refining a chunk turns each hole quad into the 4 or 16 quads under it.
  Coarsening makes a quad a hole when any finer quad under it is one, so an
  opening never closes by accident.
- The overview ignores holes. A hole on a chunk that is not loaded is not
  drawn; holes are meant as cave openings, too small to show from that far.

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
| Splat indices | `RGBA8`: the four strongest materials | 128×128, 0.5 m per texel |
| Splat weights | `RGBA8`: their weights, summing to 255 | 128×128 |
| Holes | One bit per quad | 64×64 |
| Tier | 1, 2 or 4 | One value |

Tiers multiply the height and hole sizes. The splat resolution does not
change with the tier. Heights, splat and holes are stored as three asset
parts per chunk; a chunk without holes has no hole part.

On the GPU, heights live in an `R32F` texture array per tier with a layer per
chunk, so a node spanning many chunks is still one draw. A 256×256 lookup texture,
indexed by chunk coordinates modulo 256, gives each chunk's layer and its own
coordinates, which rejects a chunk 256 away that shares the slot. Splat and
hole maps will follow the same layout. An edit re-uploads the layers it
changed.

A layer is 68×68 at ×1, 132×132 at ×2 and 260×260 at ×4: the chunk's own
samples plus a two-sample apron on every side, copied from the neighbours, or
interpolated on a neighbour's own grid when the tiers differ. The apron gives the mesh its last row
and column, and gives the normals, which blend the gradients of four samples,
their neighbours across the edge. An edit on an edge tile also rewrites the
matching strip of the neighbour's apron. Where no neighbour exists, the apron repeats the chunk's outer row,
which leaves a flat 1 m strip along the edge of the world.

## Import and export

Both work on a rectangle of chunks, the whole terrain by default.

- **Heightmap.** A 16-bit PNG or RAW at the resolution of a chosen tier.
  Values map the exported range, lowest to highest height, which is written to
  a sidecar JSON and shown in the dialog. Import asks for the target rectangle
  and the height range, creates the chunks it lacks, and is one undo step.
- **Splat map.** One grayscale PNG per material used in the rectangle, named
  after the material, 0 to 255 per texel. Import matches masks to materials by
  name, or lets the user pick, and keeps the four strongest materials per
  texel, scaled to sum to 255.

## Packages

### `@jolly-pixel/asset.terrain`

`packages/assets/terrain`, laid out like `packages/assets/voxel-map`:

- `src/asset/`: the kind, its descriptor and builders in `terrain.ts`; the
  state, decoder and kind handler in `terrainAssetKind.ts`.
- `src/model/`: `TerrainDocument`, the command state, and
  `TerrainPreview`, the displayed copy that layers live strokes over confirmed
  heights.
- `src/network/`: `TerrainCommand.schema.ts`, `TerrainCommandKeys.ts`,
  `terrainDocumentKind.ts`, the live relay (`TerrainLiveRelay.ts`) and the
  client live halves (`TerrainLiveSender.ts`, `TerrainLiveReceiver.ts`).
- `src/history/`: the `CommandHistory` registration.

### `@jolly-pixel/terrain.renderer`

`packages/terrain-renderer`, laid out like `packages/voxel-renderer`:

- `src/terrain/`: `Terrain`, `TerrainChunk`, `ChunkGrid`,
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
- `features/{sculpt,paint,holes,materials,chunks,poi,overlays,importExport}/`,
  each split into `model/`, `interaction/`, `rendering/`, `toolbar/` and
  `collaboration/` as needed.
