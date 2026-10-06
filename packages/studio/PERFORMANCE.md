# @jolly-pixel/studio — performance backlog

Open performance work, last audited on 2026-10-04. Measure an editor open from
the double-click to `data-editor-state="ready"` with `jolly-pixel:debug` set to
`*`, against a baseline worktree with interleaved runs: machine speed drifts
too much for anything else.

Items are in suggested order and form two chains: 1 then 2 (shared
chunks), 3 then 4 (mesh workers).

## Editor bundles

Each page bundles its own three.js, Lit, `@jolly-pixel/ui` and `editor.host`.
Eager (the `modulepreload` set): 2.96 MB voxel-map, 2.39 MB voxel-model,
1.00 MB pixel-art; total `assets/`: 3.43, 2.85 and 1.44 MB. The workspace
resolves one `three@0.186.1` and one `lit@3.3.3`. The studio server caches
hashed `assets/` files as immutable, so warm opens only revalidate
`index.html` and `main.css`.

### 1. Shared dependencies: decide for external editors

ADR-0016 lets the project file list editor packages from `node_modules`, and
`EditorPackage.prebuilt` ships them as self-contained dists; ADR-0017 makes
them trusted same-origin code. Neither covers shared chunks. Choose between a
joint build for in-repo editors only (external editors stay self-contained)
and an import map that serves three, lit, ui and editor.host once to every
editor (fits external editors, couples their versions), and record it in an
ADR. Blocks item 2.

### 2. Spike a multi-page build

A studio-owned config for the in-repo editors that keeps
`editors/<name>/index.html` (frames load `editors/<name>/?target=`). Payoff:
about 1 MB of three, Lit and ui reused once a second editor kind opens. It has
to solve:

- `createProjectKindsPlugin` serves `virtual:jolly-pixel/handlers` with a
  different kinds list per editor: one module id cannot serve three lists;
- separate `public/` folders: each `main.css`;
- pixel-art builds `page/index.html` (`vite.config.ts`, `root: "page"`)
  and imports `../../src/index.ts`, while voxel-map and voxel-model import
  their package `dist`;
- `jollypixel.editor.dist`, `server/EditorPages.ts` and
  `server/EditorPagesWatcher.ts` assume one dist per editor.

## Main thread

Editor frames share the shell's origin, so they run on its main thread.

### 3. Cross-origin isolation headers

Mesh workers share stores through `SharedArrayBuffer`, which needs
`crossOriginIsolated`: COOP `same-origin` and COEP `require-corp` on the
studio Vite server (`server.headers`), in `server/EditorPages.ts` through
servo `setHeaders`, and on voxel-map's dev server (voxel-renderer's own
`vite.config.ts` is the reference). No cross-origin resource found that would
break; detect-gpu is skipped because editors pass `maxFps`. Check the shell,
the frames and the offline back-end still work, and document the main-thread
fallback for static hosts without headers. Blocks item 4.

### 4. Mesh workers in voxel-map

Add a worker file calling `runMeshWorker(self)` and pass `meshing: { workers:
{ createWorker, count } }` where `VoxelRenderer` is added in
`editors/voxel-map/src/boot/EditorScene.ts` (reference:
`voxel-renderer/examples/scripts/demo-noise-world.ts`), with `worker.format:
"es"`. Give `prebundleWorkspace` a way to leave the worker package out if e2e
mode breaks its `import.meta.url` worker, and add an e2e check of the
fallback (`ChunkMeshWorkers` meshes on the main thread with a warning when not
isolated). voxel-model has no `VoxelView`. Workers help loads and edits of
large maps, not steady-state rendering.

## Considered and rejected

- **Mounting editors before snapshots arrive.** Measured on 2026-10-04,
  three runs per editor, offline and online. In voxel-map and voxel-model the
  runtime's `renderer` step takes 350 to 410 ms on the main thread while the
  session runs. The session's own steps (catalog, target, dependencies) take
  25 to 235 ms, but its leases open only once the renderer releases the thread
  (catalog done at 252 ms, target started at 516 ms). The renderer and the
  session finish within about 70 ms of each other, and mount then takes 57 to
  79 ms for a map. pixel-art has no runtime and spends about 20 ms in each of
  session and mount.
- **Returning the input from `insert`.** The parse-back costs 2.6 ms per 2 MB
  snapshot event and 3 µs per command, and the event-store contract promises
  an un-aliased, JSON-normalized event from `append`.
- **Skipping the fold validation of room commands.** Not measured; the same
  check costs 0.1 µs per command outbound, and skipping it needed a flag set
  around each append that relied on synchronous subscribers.
- **Skipping outbound validation.** It costs 2 µs for a 258 KB voxel world
  snapshot and 0.1 µs per command; not worth a network API change.
- **Dropping the editor keep-alives.** The peer and hover keep-alives in
  `PeerFrustums` and `Runtime` (#855) stop the loop from sleeping and waking
  over and over while someone works or collaborates. A hidden frame still
  goes idle: `suspendWhenHidden` stops the loop when the canvas stops
  intersecting, and a stopped loop ignores `keepAlive` and `invalidate()`
  until `start()`.
- **A visibility message from the shell to its frames.** Every rAF loop in
  the frames already pauses on its own (`BlockTurntable` through an
  IntersectionObserver, `GamepadActivity` on loop sleep and stop, the rest are
  one-shot), so no consumer would read it. `ThreeRenderer` skipping zero and
  unchanged sizes covers the tab-switch reallocation.
- **Coalescing catalog events on a microtask.** `change` fires once per
  message after the state is applied, and each relayed delta is its own
  message task, so a microtask flag would merge nothing. Folder moves and
  deletions send one `catalog:rename` or `catalog:delete` list, whose changes
  reach members in one `catalog:changed`.
- **Memoizing the tree's `expanded` array.** `jolly-tree` compares `expanded`
  and `selected` by content (`idListChanged`), so a new array with the same
  ids does not rebuild the `TreeSnapshot`.
- **OffscreenCanvas runtime.** The Lit UI mutates the same `VoxelWorld`
  synchronously (`BlockLibrary`, `VoxelLayerPanel`, `TemplatePanel`, the
  inspector panel), input reads layout and pointer lock, `GlobalAudio` needs an
  AudioContext, textures load through the DOM `Image` loader.
- **Process isolation.** A different port is the same site, so the frame stays
  in the shell's process. A different site, or `sandbox` without
  `allow-same-origin`, breaks the shared `sessionStorage` identity, Web Locks,
  BroadcastChannel, IndexedDB and the `jolly-ready` origin check, and changes
  ADR-0005's WebGL context budget. ADR-0017 rejects it; identity in the launch
  message (ROADMAP step 1) would lift only one of those blockers. Revisit only
  if ADR-0017 changes.
