# @jolly-pixel/editor.terrain ROADMAP

V1 work, in the order it should land. Each milestone ends with the tests of
every package it touches, `pnpm run typecheck` and `pnpm run lint` green.
Rebuild `@jolly-pixel/terrain.renderer` and `@jolly-pixel/asset.terrain`
first when a step touches them: the e2e back-end loads their `dist/`.

The [design](./docs/design.md) holds the decisions every milestone builds on.

## Status

- **Design: done** (2026-10-18). The decisions in `docs/` are settled; change
  them there first, then here, before changing code.
- **Package skeletons: done** (2026-10-18). `asset.terrain`,
  `terrain.renderer` and `editor.terrain` exist, are referenced from the root
  `tsconfig.json`, and contain only an empty `src/index.ts`.
- **M1 grilling: done** (2026-10-18). Its answers are in `docs/`: one owner
  per sample, the region quadtrees and node mesh, the wire format, routing in
  the terrain extension, the M1 chunk cap and the slope overlay.
- **Next:** the rest of M1's first item: the editor manifest, Vite config, dev
  port and test scripts.

Tick a box when its item lands, and move **Next** along with it.

## M1: Collaborative sculpt

Proves the riskiest parts first: collaboration and LoD. The server still loads
and sends the whole asset, capped at 256 chunks. Brushes do not create
chunks yet.

- [ ] Scaffold `@jolly-pixel/asset.terrain`, `@jolly-pixel/terrain.renderer`
  and `@jolly-pixel/editor.terrain`, with the editor manifest, the Vite
  config, a dev port and a `test` script in each package.
- [ ] Headless `TerrainDocument`: sparse chunk grid, 64×64 owned samples,
  world-space sampling, add and remove chunk with edge seeding.
- [ ] CDLOD view: region quadtrees, one 33×33 grid mesh per node, height
  textures with neighbour aprons, morphing between levels, skirts.
- [ ] Brushes: raise and lower, smooth, flatten.
- [ ] Stroke commits: tile patches, collision keys, arbiter, corrections.
- [ ] Undo and redo through `CommandHistory`.
- [ ] Interest routing in the terrain extension: live patches inside the
  presence radius; peer brush rings drawn inside it.
- [ ] Slope overlay.
- [ ] E2E: two-peer sculpt with undo, LoD seams render, a far peer receives
  the commit only.

## M2: Streaming

- [ ] Asset parts in `@jolly-pixel/asset-server`: part files, manifest-only
  join snapshot, per-part persistence and replay checkpoints.
- [ ] Part subscription: `subscribeParts`, `unsubscribeParts`, part fetch,
  and command broadcast filtered by subscription.
- [ ] Overview map, rebuilt incrementally from edited chunks.
- [ ] Camera-driven chunk loading and unloading within the stream radius.
- [ ] Lift the 256-chunk cap.

## M3: Texturing

- [ ] Terrain layers that reference image assets in the catalog.
- [ ] Albedo, normal and ORM texture arrays.
- [ ] Index and weight splat maps, and the paint brush.
- [ ] Per-layer techniques: triplanar, stochastic tiling, height blending.

## M4: Rest of V1

- [ ] Hole brush, cut and fill.
- [ ] Resolution tiers ×2 and ×4, with seam morphing.
- [ ] Points of interest: LoD bias and minimum detail at distance.
- [ ] Ramp and terrace brushes.
- [ ] Strokes that cross into empty ground create the chunk in the same
  commit.
- [ ] Heightmap and splat map import and export.
- [ ] Debug overlays: chunk grid, LoD levels, holes.

## Not planned for V1

- **Overhangs and true caves.** The surface stays a heightfield; cave
  interiors are separate mesh assets placed in hole openings.
- **Compute tessellation.** WebGPU has no tessellation stage; V1 gets detail
  from resolution tiers. The design keeps room for compute shader subdivision,
  see [future tessellation](./docs/design.md#future-tessellation).
- **Physics colliders**, foliage, water and prop placement.
- **Chunk locks.** Concurrent edits resolve last write wins, per tile.
