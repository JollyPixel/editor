# @jolly-pixel/studio — performance backlog

Open performance work, last audited on 2026-10-04. Measure an editor open from
the double-click to `data-editor-state="ready"` with `jolly-pixel:debug` set to
`*`, against a baseline worktree with interleaved runs: machine speed drifts
too much for anything else.

Items are in suggested order. Items 6 to 9 form two chains: 6 then 7 (shared
chunks), 8 then 9 (mesh workers).

## Shell and frames

### 1. Dev and e2e module graph

In dev the shell loads 724 modules (26.5 MB of transformed JS) at boot; the
crawl alone takes 1.7 s cold. The shell imports the `editor.host` root barrel,
which re-exports `EditorRuntime`, `PeerFrustums` and `bootStandalone`, and
`workspace/index.ts` statically re-exports `OfflineWorkspace`, which pulls the
network `Server`. The production build drops both through `sideEffects`, but
dev serves every module the barrels name. The editors' e2e fix of 2026-09-28
(795 to 114 requests) was not applied to the studio.

Fix: an `optimizeDeps.include` list for studio dev/e2e, and no static
`OfflineWorkspace` re-export in the host workspace barrel.

### 2. Batch folder operations

`AssetCommands` `relocate` and `remove` await one `catalog.rename` or
`catalog.remove` per asset, so a folder of K assets costs K serial round trips
and K catalog rebuilds in the shell and every frame (one rebuild takes 2.5 ms
at 1000 assets and 7.8 ms at 3000).

Fix: a batch catalog command next to `catalog:move-folder`; short of that,
send the requests together and await them once (ADR-0010 already accepts
partial application).

### 3. Mount editors before snapshots arrive

`EditorSession` awaits the target and every dependency lease before
`StandaloneEditor` mounts, so device setup, scene awake and `VoxelRenderer`
setup start only after the network round trip and decode, although
`EditorScene` already handles a late `reset`. Compare the `host.session` and
`mount` step durations before changing anything.

Fix: expose `session.ready` and await it alongside the mount.

### 4. Asset tree rendering

`AssetBrowser` passes `.expanded=${[...this._expanded]}`, a new array per
render, so every selection click rebuilds the `TreeSnapshot` and re-binds
every visible row: memoize it. Rows are not virtualized and all folders start
expanded (`ui/src/data/tree/Tree.ts`), which a large project will feel.

### 5. Offline owner heartbeat under timer throttling

`RemoteWorkspace` reloads once the owner misses heartbeats for 12 s
(`HEARTBEAT_MS` 2000, `OWNER_LOSS_MS` 12000 in `shared-tab/protocol.ts`).
Chrome's intensive throttling of tabs hidden for 5 minutes or more could make
every frame reboot when the user comes back. Inferred from the throttling
rules, not reproduced.

Fix: detect owner loss with a pending Web Lock request, or skip the check
while `document.hidden`.

## Editor bundles

Each page bundles its own three.js, Lit, `@jolly-pixel/ui` and `editor.host`.
Eager (the `modulepreload` set): 2.96 MB voxel-map, 2.39 MB voxel-model,
1.00 MB pixel-art; total `assets/`: 3.43, 2.85 and 1.44 MB. The workspace
resolves one `three@0.186.1` and one `lit@3.3.3`. The studio server caches
hashed `assets/` files as immutable, so warm opens only revalidate
`index.html`, `main.css` and `textures/`.

### 6. Shared dependencies: decide for external editors

ADR-0016 lets the project file list editor packages from `node_modules`, and
`EditorPackage.prebuilt` ships them as self-contained dists; ADR-0017 makes
them trusted same-origin code. Neither covers shared chunks. Choose between a
joint build for in-repo editors only (external editors stay self-contained)
and an import map that serves three, lit, ui and editor.host once to every
editor (fits external editors, couples their versions), and record it in an
ADR. Blocks item 7.

### 7. Spike a multi-page build

A studio-owned config for the in-repo editors that keeps
`editors/<name>/index.html` (frames load `editors/<name>/?target=`). Payoff:
about 1 MB of three, Lit and ui reused once a second editor kind opens. It has
to solve:

- `createProjectKindsPlugin` serves `virtual:jolly-pixel/handlers` with a
  different kinds list per editor: one module id cannot serve three lists;
- separate `public/` folders: each `main.css`, and voxel-map's
  `textures/tileset.png` fetched by relative URL (`src/boot/worldProject.ts`);
- pixel-art builds `page/index.html` (`vite.config.ts`, `root: "page"`)
  and imports `../../src/index.ts`, while voxel-map and voxel-model import
  their package `dist`;
- voxel-model sets the deprecated `esbuild.target: "es2024"` and runs
  `vite-plugin-checker`;
- `jollypixel.editor.dist`, `server/EditorPages.ts` and
  `server/EditorPagesWatcher.ts` assume one dist per editor.

## Main thread

Editor frames share the shell's origin, so they run on its main thread.

### 8. Cross-origin isolation headers

Mesh workers share stores through `SharedArrayBuffer`, which needs
`crossOriginIsolated`: COOP `same-origin` and COEP `require-corp` on the
studio Vite server (`server.headers`), in `server/EditorPages.ts` through
servo `setHeaders`, and on voxel-map's dev server (voxel-renderer's own
`vite.config.ts` is the reference). No cross-origin resource found that would
break; detect-gpu is skipped because editors pass `maxFps`. Check the shell,
the frames and the offline back-end still work, and document the main-thread
fallback for static hosts without headers. Blocks item 9.

### 9. Mesh workers in voxel-map

Add a worker file calling `runMeshWorker(self)` and pass `meshing: { workers:
{ createWorker, count } }` where `VoxelRenderer` is added in
`editors/voxel-map/src/scene/EditorScene.ts` (reference:
`voxel-renderer/examples/scripts/demo-noise-world.ts`), with `worker.format:
"es"`. Check the e2e `optimizeDeps` list with `import.meta.url` workers, and
add an e2e check of the fallback (`ChunkMeshWorkers` meshes on the main thread
with a warning when not isolated). voxel-model has no `VoxelView`. Workers
help loads and edits of large maps, not steady-state rendering.

## Considered and rejected

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
  message task, so a microtask flag would merge nothing; bursts across
  deltas belong to item 2.
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
