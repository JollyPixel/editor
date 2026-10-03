# @jolly-pixel/studio — performance backlog

Open performance work, last audited on 2026-10-03. Measure an editor open from
the double-click to `data-editor-state="ready"` with `jolly-pixel:debug` set to
`*`, against a baseline worktree with interleaved runs: machine speed drifts
too much for anything else.

Suggested order: 1 (it loses data) and 2; then the small ones: 9, 13, 10, 3,
12, 18; then 17, 4, 11 and 14; the rest as they come. Items 19 to 22 form two
chains: 19 then 20 (shared chunks), 21 then 22 (mesh workers).

## Server

### 1. Snapshots reload the live state

`AssetStateStore.#follow` folds every event, including the `asset.updated`
the snapshot scheduler appends itself (`SnapshotScheduler.ts`), and
`foldAssetEvent` then calls `handler.load()`: a full voxel world rebuild or a
PNG decode every 2 to 30 s per open asset. The scheduler awaits `serialize`
and `contentHash` before appending, so a command applied in that gap is
overwritten by the older bytes. Reproduced in the package harness: two
increments, a snapshot, one increment during it, and the live value ends at 2
instead of 3.

Fix: treat state-neutral snapshot-actor events as version-only (advance the
open version, skip `load`).

### 2. SQLite journal settings

`event-store/src/persistence/sqlite/index.ts` opens `DatabaseSync` with no
pragmas, so every append runs with the rollback journal and
`synchronous=FULL`. With the real `SqliteEventLog`, a small append takes
3.67 ms by default and 0.049 ms with WAL and `synchronous=NORMAL`; a 2 MB
snapshot event drops from 11.9 ms to 8.2 ms. Painting at 60 commands/s spends
about 22% of the server thread in fsync, and joins, presence and catalog
messages wait behind it.

Fix: `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;` after open, and
ignore the `-shm`/`-wal` files.

### 3. Cache voxel snapshots by version

pixel-art has `encodeSnapshot` and a PNG cache per room version; voxel-map
and voxel-model have neither, so `SnapshotCache.current()` serializes the
whole document again for every join and resync, then validates it outbound.

Fix: cache `snapshot()` per room version, as pixel-art does.

### 4. Reconcile only what changed

`reconcile/SourceWatcher.ts` drops the changed paths and
`createAssetBackend.ts` reconciles the whole workspace: `Reconciler` reads and
hashes every file. The projector's own snapshot writes echo back through
chokidar and trigger the same full scan. `FilesystemAssetWatcher` sets
`ignoreInitial: false`, which repeats the `reconcileOnStart` pass at boot.
Cost grows with workspace size.

Fix: reconcile the changed paths, ignore the projector's own (path, hash)
writes, set `ignoreInitial: true`.

### 5. Event log growth

Every snapshot appends the full asset as base64. Compaction and a synchronous
`VACUUM` run only at open (`createAssetWorkspace.ts`, `sqlite/log.ts`), so the
log grows for the whole session and the next boot pays for it.

Fix: prune superseded events after each snapshot, keeping a `resumeLimit`
window, and switch to incremental vacuum.

### 6. Projector memory

`projection/applyProjection.ts` keeps every asset's base64 content for the
process lifetime: about 1.33x the workspace size in heap, plus parse time at
boot.

### 7. Redundant validation and serialization

Each command is validated three times: inbound in `ServerRoom`, again when
folded in `foldAssetEvent`, and outbound per broadcast. `SqliteEventLog.insert`
stringifies the event and parses it back (`serialize.ts`), then the broadcast
stringifies it again. Not measured.

Fix: trust validated commands when folding live, skip outbound validation for
command messages, return the input from `insert`.

### 8. Disabled debug logs still build metadata

`Server.ts` and `createAssetBackend.ts` build LogLayer metadata for debug
calls that pino then drops. Fix: set the LogLayer level to match pino.

## Shell and frames

### 9. The shell's eager chunk carries three.js

`editors/host/src/debug/readDebugLogger.ts` imports `Systems` from the
`@jolly-pixel/engine` root barrel, and neither `engine` nor `editor.host`
declares `sideEffects`. The shell entry (230 kB minified) carries 109 kB of
`three.core`, 13 kB of engine and 12 kB of reflect-metadata for one logger,
used only by `EditorFrames`. The pixel-art page (a 2D editor) shows
`__THREE__` in its entry chunk too, likely through host `EditorSession`.

Fix: `"sideEffects"` on engine and editor.host, listing the real ones
(reflect-metadata), or a host logger that does not import the engine barrel.

### 10. Coalesce catalog rebuilds

`AssetBrowser` rebuilds the whole `AssetTreeModel` on both `change` and
`dependencies`, and `CatalogClient` emits one `change` plus one `dependencies`
per changed asset: two rebuilds per delta, 1 + D for a snapshot received while
listening. `StudioSession` re-renders `<jolly-studio>` on each event and
`ProjectOverview` recounts. `CatalogShare` relays every event to every frame,
hidden ones included, where `EditorSession` runs `#syncDependencies` twice and
`MapTilesets.refresh` once more. One rebuild takes 0.66 ms at 200 assets,
2.5 ms at 1000 and 7.8 ms at 3000; the 1 + D burst reaches 1.3 s at 1000.

Fix: mark dirty and rebuild once per microtask or frame from one listener, in
the shell and in `EditorSession`.

### 11. Batch folder operations

`AssetCommands` `relocate` and `remove` await one `catalog.rename` or
`catalog.remove` per asset, so a folder of K assets costs K serial round trips
and K rebuild cascades (item 10) in the shell and every frame.

Fix: a batch catalog command next to `catalog:move-folder`; short of that,
send the requests together and await them once (ADR-0010 already accepts
partial application).

### 12. Tell frames when they are hidden

A hidden same-origin iframe keeps `requestAnimationFrame` at full rate and
`visibilityState` at `"visible"`. `suspendWhenHidden` stops the runtime loop
through an IntersectionObserver, but other rAF loops keep running, and
`ThreeRenderer` sees a 0x0 size then the old one, reallocating the framebuffer
and post-processing targets on every tab switch (possibly linked to the open
"Destroyed texture" resize warning).

Fix: post a visibility message from `EditorFrames.show` and expose it on
`context.shell`; ignore zero or unchanged sizes in `ThreeRenderer`.

### 13. Keep-alives that defeat render on demand

`PeerFrustums` keeps the loop alive while `room.peers.size > 0`, and `Runtime`
while the pointer hovers the canvas. voxel-map runs uncapped (`maxFps:
Infinity`), so with one collaborator, or with the pointer resting on the
canvas, the frame renders at display rate on the main thread it shares with
the shell and the other frames. `PeerFrustumSync` already requests a frame on
every remote pose.

Both keep-alives were added on purpose (#855); confirm the intent first. Then
drop the peer keep-alive in favour of invalidating on `sync`/`peer-joined`,
and limit the hover keep-alive to a few frames after the last `pointermove`.
The voxel-model scene relies on these events through its `SceneWaker`, not on
the peer keep-alive.

### 14. Mount editors before snapshots arrive

`EditorSession` awaits the target and every dependency lease before
`StandaloneEditor` mounts, so device setup, scene awake and `VoxelRenderer`
setup start only after the network round trip and decode, although
`EditorScene` already handles a late `reset`. Compare the `host.session` and
`mount` step durations before changing anything.

Fix: expose `session.ready` and await it alongside the mount.

### 15. Offline owner heartbeat under timer throttling

`RemoteWorkspace` reloads once the owner misses heartbeats for 12 s
(`HEARTBEAT_MS` 2000, `OWNER_LOSS_MS` 12000 in `shared-tab/protocol.ts`).
Chrome's intensive throttling of tabs hidden for 5 minutes or more could make
every frame reboot when the user comes back. Inferred from the throttling
rules, not reproduced.

Fix: detect owner loss with a pending Web Lock request, or skip the check
while `document.hidden`.

### 16. Asset tree rendering

`AssetBrowser` passes `.expanded=${[...this._expanded]}`, a new array per
render, so every selection click rebuilds the `TreeSnapshot` and re-binds
every visible row: memoize it. Rows are not virtualized and all folders start
expanded (`ui/src/data/tree/Tree.ts`), which a large project will feel.

### 17. Dev and e2e module graph

In dev the shell loads 724 modules (26.5 MB of transformed JS) at boot; the
crawl alone takes 1.7 s cold. The shell imports the `editor.host` root barrel,
which re-exports `EditorRuntime`, `PeerFrustums` and `bootStandalone`, and
`workspace/index.ts` statically re-exports `OfflineWorkspace`, which pulls the
network `Server` (the build reports `INEFFECTIVE_DYNAMIC_IMPORT`). The
editors' e2e fix of 2026-09-28 (795 to 114 requests) was not applied to the
studio.

Fix: an `optimizeDeps.include` list for studio dev/e2e, and no static
`OfflineWorkspace` re-export in the host workspace barrel.

## Editor bundles

Each page bundles its own three.js, Lit, `@jolly-pixel/ui` and `editor.host`.
Eager (the `modulepreload` set): 2.96 MB voxel-map, 2.39 MB voxel-model,
1.09 MB pixel-art; total `assets/`: 3.42, 2.85 and 1.53 MB. The workspace
resolves one `three@0.186.1` and one `lit@3.3.3`. The network `Server`, pino
and ata-validator are no longer eager; only the client `loglayer` is.

### 18. Immutable caching for hashed assets

`server/EditorPages.ts` mounts servo with `dev: true`, which forces
`no-cache`, so a warm open revalidates 12 to 15 hashed files per editor.
servo's `setHeaders` runs last and can override it: `public,
max-age=31536000, immutable` for `assets/*`, `no-cache` for `index.html`,
`main.css` and `textures/`. Independent of item 20; covers the studio server
only, static hosts set their own headers.

### 19. Shared dependencies: decide for external editors

ADR-0016 lets the project file list editor packages from `node_modules`, and
`EditorPackage.prebuilt` ships them as self-contained dists; ADR-0017 makes
them trusted same-origin code. Neither covers shared chunks. Choose between a
joint build for in-repo editors only (external editors stay self-contained)
and an import map that serves three, lit, ui and editor.host once to every
editor (fits external editors, couples their versions), and record it in an
ADR. Blocks item 20.

### 20. Spike a multi-page build

A studio-owned config for the in-repo editors that keeps
`editors/<name>/index.html` (frames load `editors/<name>/?target=`). Payoff:
about 1 MB of three, Lit and ui reused once a second editor kind opens, with
item 18 for warm opens. It has to solve:

- `createProjectKindsPlugin` serves `virtual:jolly-pixel/handlers` with a
  different kinds list per editor: one module id cannot serve three lists;
- separate `public/` folders: each `main.css`, and voxel-map's
  `textures/tileset.png` fetched by relative URL (`src/boot/worldProject.ts`);
- pixel-art builds `page/index.html` (`vite.page.config.ts`, `root: "page"`)
  and imports `../../src/index.ts`, while voxel-map and voxel-model import
  their package `dist`;
- voxel-model sets the deprecated `esbuild.target: "es2024"` and runs
  `vite-plugin-checker`;
- `jollypixel.editor.dist`, `server/EditorPages.ts` and
  `server/EditorPagesWatcher.ts` assume one dist per editor.

## Main thread

Editor frames share the shell's origin, so they run on its main thread.

### 21. Cross-origin isolation headers

Mesh workers share stores through `SharedArrayBuffer`, which needs
`crossOriginIsolated`: COOP `same-origin` and COEP `require-corp` on the
studio Vite server (`server.headers`), in `server/EditorPages.ts` through
servo `setHeaders`, and on voxel-map's dev server (voxel-renderer's own
`vite.config.ts` is the reference). No cross-origin resource found that would
break; detect-gpu is skipped because editors pass `maxFps`. Check the shell,
the frames and the offline back-end still work, and document the main-thread
fallback for static hosts without headers. Blocks item 22.

### 22. Mesh workers in voxel-map

Add a worker file calling `runMeshWorker(self)` and pass `meshing: { workers:
{ createWorker, count } }` where `VoxelRenderer` is added in
`editors/voxel-map/src/scene/EditorScene.ts` (reference:
`voxel-renderer/examples/scripts/demo-noise-world.ts`), with `worker.format:
"es"`. Check the e2e `optimizeDeps` list with `import.meta.url` workers, and
add an e2e check of the fallback (`ChunkMeshWorkers` meshes on the main thread
with a warning when not isolated). voxel-model has no `VoxelView`. Workers
help loads and edits of large maps, not steady-state rendering.

### Considered and rejected

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
