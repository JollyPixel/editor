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
  `terrain.renderer` and `editor.terrain` exist and are referenced from the
  root `tsconfig.json`.
- **M1 grilling: done** (2026-10-18). Its answers are in `docs/`: one owner
  per sample, the region quadtrees and node mesh, the wire format, routing in
  the terrain extension, the M1 chunk cap and the slope overlay.
- **Scaffold and headless document: done** (2026-10-18). The editor boots on
  port 3008 and opens a seeded terrain; chunks can be added and removed.
- **CDLOD view: done** (2026-10-18). The editor draws the terrain with LoD,
  morphing and per-pixel normals.
- **Brushes: done** (2026-10-18). Raise and lower, smooth and flatten edit
  the local terrain; nothing reaches peers or the saved asset until stroke
  commits land.
- **Stroke commits: done** (2026-10-18). A stroke reaches peers and the saved
  asset as `heights-patched` commits, at its end, every 2 s and once 4 chunks
  are touched.
- **Undo and redo: done** (2026-10-18). A stroke is one step, Ctrl+Z and
  Ctrl+Y or the toolbar buttons; a step a peer has changed since is skipped.
- **Presence: done** (2026-10-19). Peers show in the presence stack and as
  camera frustums; each client publishes its interest region and brush ring,
  and draws peers' rings inside its presence radius.
- **Interest routing: done** (2026-10-19). Live patches reach only the peers
  whose presence region overlaps them, through the terrain room's relay.
- **Fixed flatten: done** (2026-10-19). Flatten targets the height under the
  press or a fixed height from the toolbar; Ctrl+click picks it.
- **Slope overlay: done** (2026-10-19). `TerrainView.overlay = "slope"` colours
  the surface by slope and marks it red above `walkableSlope`.
- **M1 end-to-end test: done** (2026-10-19). Two peers sculpt and undo, a far
  peer receives only the commit, and the surface shows no gap across LoD
  levels.
- **M1: done** (2026-10-19).
- **M2 grilling: done** (2026-10-21). Parts live in a sibling
  `<asset>.parts/` folder; a checkpoint is one generation, a single
  `asset.updated` holding the manifest, the changed parts and the version
  that holds each other part; the server keeps every part in memory; the
  `subscribeParts` reply carries the parts. See the
  [asset parts design](../../asset-server/architecture/AssetParts.md).
- **Part checkpoints: done** (2026-10-21). A kind declares `parts`;
  creation, generations, replay and compaction handle them. Kinds without
  parts are unchanged.
- **Part files: done** (2026-10-21). Parts are stored in
  `<asset>.parts/`; the projector, reconciler, folders, tags, archives and
  seeding handle them.
- **Part subscription: done** (2026-10-21). An asset room answers part
  subscriptions with the parts and sends each command only to the members
  subscribed to its parts, and `outside(command)` to the others.
- **Terrain on parts: done** (2026-10-21). The chunk list is the asset file
  and the room snapshot; each chunk's heights are a `.bin` part. The editor
  subscribes to every chunk through `TerrainPartsRoom`, and the room still
  sends every command to every member.
- **Overview map: done** (2026-10-21). `Terrain.overview` holds each
  chunk's heights at the 32 m grid points, updated on every edit, and the
  asset file and room snapshot list them. Colour comes with M3; drawing from
  it comes with camera-driven loading.
- **Camera-driven loading: done** (2026-10-22). The document knows every
  chunk through the overview and loads those within 8 chunks of the camera;
  the view draws the rest from the overview. Far members receive only the
  tiles that hold overview samples, and undo skips a step on unloaded chunks.
- **Chunk cap lifted** (2026-10-22). A terrain holds up to 4096 chunks
  within coordinates -128 to 127; LoD selection keeps node bounds between
  frames to stay under a millisecond at that size.
- **Tile corrections: done** (2026-10-22). The room admits a patch's valid
  tiles and answers the author with the refused tiles' current heights
  instead of a snapshot; an undo that raced a peer is still refused whole.
- **M2: done** (2026-10-22).
- **M3 grilling: done** (2026-10-26). Layer maps reference the built-in
  `texture` kind. Splat is a second part per chunk. Layers keep a fixed slot,
  at most 32, and a deleted layer's paint is skipped, not rewritten. The
  texture size is a terrain setting. The overview holds each sample's
  dominant layer. See [texture](./docs/texture.md).
- **Texture rooms: done** (2026-10-26). The built-in `texture` kind opens a
  room whose snapshot is the file and that accepts no command;
  `TEXTURE_ASSET` lists textures in the asset picker.
- **Next:** terrain layers in the manifest.

Tick a box when its item lands, and move **Next** along with it.

## M1: Collaborative sculpt

Proves the riskiest parts first: collaboration and LoD. The server still loads
and sends the whole asset, capped at 256 chunks. Brushes do not create
chunks yet.

- [x] Scaffold `@jolly-pixel/asset.terrain`, `@jolly-pixel/terrain.renderer`
  and `@jolly-pixel/editor.terrain`, with the editor manifest, the Vite
  config, dev port 3008 and a `test` script in each package.
- [x] Headless `Terrain`: sparse chunk grid, 64×64 owned samples,
  world-space sampling, add and remove chunk with edge seeding.
- [x] CDLOD view: region quadtrees, one 33×33 grid mesh per node, height
  textures with neighbour aprons, morphing between levels, skirts. It
  replaces the editor's placeholder ground grid.
- [x] Brushes: raise and lower, smooth, flatten.
- [x] Flatten to a fixed height set in the toolbar; Ctrl+click picks it.
- [x] Stroke commits: tile patches, collision keys, arbiter, corrections.
- [x] Undo and redo through `CommandHistory`.
- [x] Interest routing in the terrain extension: live patches inside the
  presence radius; peer brush rings drawn inside it.
- [x] Debug overlays: chunk grid and LoD levels.
- [x] Slope overlay.
- [x] E2E: two-peer sculpt with undo, LoD seams render, a far peer receives
  the commit only.

## M2: Streaming

- [x] Asset parts in `@jolly-pixel/asset-server`: part files, manifest-only
  join snapshot, per-part persistence and replay checkpoints.
- [x] Part subscription: `subscribeParts`, `unsubscribeParts`, part fetch,
  and command broadcast filtered by subscription.
- [x] Overview map, rebuilt incrementally from edited chunks.
- [x] Camera-driven chunk loading and unloading within the stream radius.
- [x] Lift the 256-chunk cap.
- [x] Tile corrections for refused commits, refused per tile, instead of the
  snapshot the room sends back today.

## M3: Texturing

- [x] A read-only room for the built-in `texture` kind, and its descriptor.
- [ ] Terrain layers in the manifest: slots, the seeded "Ground" layer, layer
  commands keyed per field, image dependencies, and the texture size setting.
- [ ] Albedo, normal and ORM texture arrays, rebuilt when an image or the
  texture size changes.
- [ ] Splat parts, `splat-patched` commits, and the overview's dominant layer.
- [ ] Layers panel, the paint tool in the brush toolbar, and Ctrl+click layer
  pick.
- [ ] Splat overlay.
- [ ] Per-layer techniques: triplanar, stochastic tiling, height blending.
- [ ] E2E: two peers paint and sculpt the same chunk, a far peer's horizon
  takes the new dominant layer.
- [ ] Replace an asset's content from the catalog, keeping its ID, so a
  re-imported texture updates the terrains that use it.

## M4: Rest of V1

- [ ] Hole brush, cut and fill.
- [ ] Resolution tiers ×2 and ×4, with seam morphing.
- [ ] Points of interest: LoD bias and minimum detail at distance.
- [ ] Ramp and terrace brushes.
- [ ] Strokes that cross into empty ground create the chunk in the same
  commit.
- [ ] Heightmap and splat map import and export.
- [ ] Debug overlay for holes.

## Not planned for V1

- **Overhangs and true caves.** The surface stays a heightfield; cave
  interiors are separate mesh assets placed in hole openings.
- **Compute tessellation.** WebGPU has no tessellation stage; V1 gets detail
  from resolution tiers. The design keeps room for compute shader subdivision,
  see [future tessellation](./docs/design.md#future-tessellation).
- **Physics colliders**, foliage, water and prop placement.
- **Chunk locks.** Concurrent edits resolve last write wins, per tile.

## After V1

- **Lazy part loading on the server.** M2 keeps every part of an open
  terrain in server memory. Load parts on first subscription or command from
  the event store, and unload those no member subscribes to once a checkpoint
  holds them.
- **HTTP delivery for textures.** A texture travels base64 in its room
  snapshot, with no browser cache, and a peer-to-peer session cannot send one
  much above 12 MB. Serve texture files over a cacheable route instead.
