# @jolly-pixel/studio — ROADMAP

Open work, in the order it should land. Decisions already taken are in the
[ADRs](./docs/adr/README.md). Each step ends with
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

The goal of the first two steps is kinds and editors loaded from outside
the monorepo (a project folder, a package in `node_modules`), keeping
[ADR-0002](./docs/adr/0002-the-shell-consumes-data-only.md): kind code stays
in back-end handlers, editor code stays in iframes.

## 1. `project.json`

- `project/.jollypixel/project.json` lists the editor packages and the kind
  packages. The Vite config reads it instead of hard-coded lists; the
  handler list comes from the kind packages (one factory export per package,
  taking the project's options).
- The editors' own Vite configs and offline workspaces keep their private
  lists until they open a project the same way. Until then, handler
  registration stays duplicated between the studio and each editor.
- Tests: a project file resolves editors and kinds; a missing package or a
  kind claimed twice fails with the package named.

## 2. External kinds and editors

- Resolve packages from the project folder's `node_modules`, not only the
  studio's, and descriptors or editors from a local folder.
- Replace the `virtual:jolly-pixel/editors` build-time module with a served
  manifest (`/editors.json` plus descriptors), so adding an editor needs no
  studio rebuild. The registry and the manifest shapes stay the same.
- Settle trust: an external editor runs same-origin in an iframe today, with
  full access to the shell's storage and back-end session.

## 3. Identity in the launch message

The shell already prompts once and editor frames read the stored name from
`sessionStorage`, but each frame mints its own peer id. Carrying the identity
in `jolly-launch` gives one user one presence color across tabs.

## 4. Authentication

The shell logs in once, the launch message carries a token, and the network
`AuthenticationProvider` checks it on upgrade. Editors never learn how the
identity was obtained.

## 5. Preferences and settings pane

A per-user store the shell owns, reached from the header toolbar. The open
tabs, the dock layout and the kind filter move there from `localStorage`.

## 6. Runtime tab

Another page in another iframe that plays the project. No editor contract
involved; its action goes in the header toolbar.

## 7. In-process editors

Mount editors in the shell's document instead of iframes. Waits for the
`EditorDefinition` revisit in the
[editor host roadmap](../editors/host/ROADMAP.md): `mount` takes a container,
not `document`.

## Performance

Opening an editor tab was measured from the double-click to
`data-editor-state="ready"`, with `jolly-pixel:debug` set to `*` so each boot
step logs its duration. Machine speed drifts, so compare against a baseline
worktree with interleaved runs. After the first pass, a voxel-map tab opens
in about 0.9 s cold and 0.45 s warm, down from 2.1 s and 0.9 s. What is left,
roughly by expected gain:

- **Pixel snapshots.** A voxel-map open receives its tileset as base64 raw
  RGBA, 2.7 MB for a 1024x512 texture whose PNG is 68 KB, parsed and decoded
  on the main thread. A compressed binary payload, inflated with
  `DecompressionStream`, and an encoded snapshot cached per room revision
  would cut the transfer and the decode. Pixel-art documents use the same
  encoding.
- **Shared editor chunks.** Each editor page bundles its own three.js, Lit,
  `@jolly-pixel/ui` and `editor.host`: 2.8 MB eager for voxel-map, 2.3 MB for
  voxel-model, 1 MB for pixel-art. One multi-page build for the studio's
  editors would share those chunks, so the HTTP and V8 code caches of one
  editor serve the next. The page handler serves hashed assets with
  `no-cache`; they could be `immutable`.
- **Warm standby frames.** A hidden frame per editor kind, booted up to the
  launch handshake with its runtime created, would leave only the session and
  the scene to an open. It costs a frame and a GPU context per kind.
- **Shared main thread.** Editor frames share the shell's origin, so they run
  on its main thread: a heavy boot or frame stalls the shell. Mesh workers
  (`ChunkMeshWorkers`) are unused by the editors, and an `OffscreenCanvas`
  runtime in a worker would take rendering off that thread.
- **Render on demand.** A visible voxel-map tab with nothing changing still
  spends about 10% of the main thread rendering every frame.
- **Cold asset rooms.** A room's first join replays the asset twice:
  `AssetStateStore` folds the log, then `AssetRoomExtension` re-reads the same
  range to restore its arbiter. Its message validators are compiled per room,
  and a room is evicted 30 s after its last client leaves.
- **One catalog per frame.** Every frame opens its own WebSocket and receives
  the whole catalog and dependency map. Offline, every message to a frame is
  cloned to every tab on the BroadcastChannel and parsed twice before it is
  dropped.
- **Metrics panel.** voxel-map awaits its hidden metrics panel before it is
  ready; the layout e2e presses F3 right after, so it needs a readiness signal
  first.
- **Dev server.** `vite` crashes with `EBUSY` on Windows when
  `pnpm run build:page` empties `dist-page` while the studio watches it.

## Waiting for a trigger

- **Shell commands from editors.** The host posts `toggle-console` on Ctrl+K,
  but no editor calls `context.shell` since the voxel-map Paint action was
  dropped. Title and dirty state are the expected next commands; add them
  when an editor needs the shell to show either.
- **Editor commands in the studio console.** A framed editor still registers
  its namespaces (`brush`, `keybind`) on `context.commands`, but only the
  shell's console shows, so they are out of reach inside the studio. Reaching
  them needs a request and response channel, which
  [ADR-0004](./docs/adr/0004-the-shell-channel-is-one-way.md) defers.
