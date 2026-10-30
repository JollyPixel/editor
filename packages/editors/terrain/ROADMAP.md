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
- **Layers in the manifest: done** (2026-10-26). The asset file and room
  snapshot hold the layers and the texture size; `TerrainDocument` adds,
  updates and removes layers, keyed per field, and undoes each change. A file
  without layers loads with the Ground layer.
- **Texture arrays: done** (2026-10-26). The view holds albedo, normal and
  ORM arrays, one array layer per terrain layer, filled by GPU copy. The
  editor leases each layer's textures, decodes them at the terrain's texture
  size and uploads them again when a texture or the size changes. Until splat
  maps land, the surface draws slot 0.
- **Materials: done** (2026-10-27). Terrain layers are now materials
  (`TerrainMaterial`, `material-added` and so on) with a fourth map, height,
  which height blending reads instead of the albedo's alpha. The panel is a
  palette of the terrain's own materials, drawn as swatches; see
  [material palette](./docs/texture.md#material-palette).
- **Material palette: done** (2026-10-27). The Materials pane shows the
  terrain's materials as swatches; a material is added from a picked texture
  or from dropped images, with its sibling maps found by name, and edited
  through a Scale field and folded Maps and Look sections. The techniques are
  stored but not drawn yet.
- **Splat data: done** (2026-10-27). Each chunk holds a splat map, stored as
  its `<x>_<z>_splat` part and changed by `splat-patched` commits keyed apart
  from heights; the overview and the manifest keep each 32 m point's dominant
  material. A chunk loads from its heights and takes its splat when it
  arrives. Nothing paints or draws it yet.
- **Splat rendering: done** (2026-10-27). The view uploads each chunk's
  splat, the shader blends four materials per pixel with jittered texel
  edges, and the far overview draws each point's dominant material. First
  half of the paint tool item.
- **Paint tool: done** (2026-10-27). The brush toolbar's Paint tool paints the
  material selected in the palette, shown at once to the painter and
  committed on the stroke cadence as one undo step; Ctrl+click selects the
  material under the cursor. Peers see paint at each commit, not live.
- **Per-material techniques: done** (2026-10-27). The Look toggles reach the
  view: triplanar on steep slopes, stochastic tiling and height blending,
  each sampled only where its material is painted.
- **Splat overlay: done** (2026-10-27). The "Painted materials" overlay
  colours each slot, shows the colour on its swatch and highlights the
  selected material.
- **M3 end-to-end test: done** (2026-10-27). Two peers paint and sculpt the
  same chunk and undo the paint alone; a far peer's horizon takes the new
  dominant material without loading the chunk. The material shader now loops
  over projections and stochastic cells instead of unrolling them, so software
  WebGL compiles it.
- **Catalog replace: done** (2026-10-27). `catalog:replace` writes new
  content into an existing asset, keeping its ID, behind a restore point. The
  studio offers it on an asset, and the palette asks to replace a dropped
  image whose texture already exists, which repaints every terrain using it.
  M3 is complete.
- **M4 grilling: done** (2026-10-29). Holes are a third part per chunk,
  committed like paint and absent from the overview; the hole tool's ray hits
  the kept heights. A Chunks tool adds, removes and refines chunks, so
  brushes never create them. Tiers keep one GPU array each, and their undo
  restores the replaced heights. Points of interest are chunk sets kept
  loaded at any distance. See [brush](./docs/brush.md),
  [design](./docs/design.md) and [collaboration](./docs/collaboration.md).
- **Hole data: done** (2026-10-29). Each chunk holds a hole mask, one bit
  per quad, stored as its `<x>_<z>_holes` part while it has holes and changed
  by `holes-patched` commits on their own channel. Far members receive
  nothing of them, and undoing a chunk's removal brings its holes back.
  Nothing cuts or draws them yet.
- **Hole rendering: done** (2026-10-29). The view uploads each loaded chunk's
  mask as a max pyramid and discards a pixel whose LoD cell holds a hole, so
  an opening shows at every level and a filled one closes. Peers' cuts and
  fills show at each commit.
- **Hole tool: done** (2026-10-29). Cut and Fill in the toolbar, Ctrl
  inverting while held; a quad changes when its centre lies inside the
  radius. The tool's ray hits the heights kept under a hole, other tools aim
  through it. A stroke shows at once, commits on the stroke cadence and undoes
  as one step.
- **Holes overlay: done** (2026-10-29). The Holes overlay draws hole cells
  over the surface kept under them, tinted and outlined cell by cell. The
  hole tool shows them the same way while selected, over whichever overlay is
  on, so its cuts and fills stay visible.
- **Chunks tool: done** (2026-10-30). Add and Remove in the brush toolbar,
  Ctrl swapping them for the next press. A ghost outlines the target chunk,
  grey where the click would be refused, and the chunk borders show while
  the tool is selected. A drag works on every chunk the cursor crosses and
  undoes as one step. The Detail mode waits for the resolution tiers.
- **Next:** resolution tiers ×2 and ×4, set from the Chunks tool's Detail
  mode.

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
- [x] Terrain layers in the manifest: slots, the seeded "Ground" layer, layer
  commands keyed per field, image dependencies, and the texture size setting.
- [x] Albedo, normal and ORM texture arrays, rebuilt when an image or the
  texture size changes.
- [x] Rename layers to materials, and add the height map.
- [x] Material palette: swatches of the terrain's materials with map badges,
  selection, adding from an image with its sibling maps found by name, and
  editing a material's maps, tiling and flags.
- [x] Splat parts, `splat-patched` commits, and the overview's dominant
  material.
- [x] The paint tool: the splat drawn in the view, then the Paint tool in the
  brush toolbar painting the selected material, and Ctrl+click material
  pick.
- [x] Splat overlay.
- [x] Per-material techniques: triplanar, stochastic tiling, height blending.
- [x] E2E: two peers paint and sculpt the same chunk, a far peer's horizon
  takes the new dominant material.
- [x] Replace an asset's content from the catalog, keeping its ID, so a
  re-imported texture updates the terrains that use it.

## M4: Rest of V1

- [x] Hole brush, cut and fill: the `<x>_<z>_holes` part, `holes-patched`
  commits, the mask drawn in the view, and the tool.
- [x] Debug overlay for holes.
- [x] Chunks tool: add and remove chunks by click or drag, one undo step.
- [ ] Resolution tiers ×2 and ×4, with seam morphing, set from the Chunks
  tool's Detail mode.
- [ ] Points of interest: chunk sets with an LoD bias and a minimum detail
  level, kept loaded at any distance, edited in their pane.
- [ ] Ramp and terrace brushes.
- [ ] Heightmap and splat map import and export.

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
- **Material streaming.** The view holds every material of a terrain in its
  arrays, which caps a terrain at 32 materials. Hold only those painted on
  the loaded chunks, so a terrain can use all 256 slots.
- **HTTP delivery for textures.** A texture travels base64 in its room
  snapshot, with no browser cache, and a peer-to-peer session cannot send one
  much above 12 MB. Serve texture files over a cacheable route instead.
