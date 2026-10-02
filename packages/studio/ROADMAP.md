# @jolly-pixel/studio — ROADMAP

Open work, in the order it should land. Decisions already taken are in the
[ADRs](./docs/adr/README.md). Each step ends with
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

The goal of the first step is kinds and editors loaded from outside the
monorepo (a project folder, a package in `node_modules`), keeping
[ADR-0002](./docs/adr/0002-the-shell-consumes-data-only.md): kind code stays
in back-end handlers, editor code stays in iframes. The project file already
lists them ([ADR-0016](./docs/adr/0016-the-project-file-lists-editors-and-kinds.md)).

## 1. External kinds and editors

- Resolve packages from the project folder's `node_modules`, not only the
  studio's, and descriptors or editors from a local folder.
- Replace the `virtual:jolly-pixel/project` build-time module with a served
  manifest (`/editors.json` plus descriptors), so adding an editor needs no
  studio rebuild. The registry and the manifest shapes stay the same.
- Settle trust: an external editor runs same-origin in an iframe today, with
  full access to the shell's storage and back-end session.
- The editors' own Vite configs and offline workspaces open a project the
  same way, ending the duplicated handler registration.

## 2. Identity in the launch message

The shell already prompts once and editor frames read the stored name from
`sessionStorage`, but each frame mints its own peer id. Carrying the identity
in `jolly-launch` gives one user one presence color across tabs.

## 3. Authentication

The shell logs in once, the launch message carries a token, and the network
`AuthenticationProvider` checks it on upgrade. Editors never learn how the
identity was obtained.

## 4. Preferences and settings pane

A per-user store the shell owns, reached from the header toolbar. The open
tabs, the dock layout and the kind filter move there from `localStorage`.

## 5. Runtime tab

Another page in another iframe that plays the project. No editor contract
involved; its action goes in the header toolbar.

## 6. In-process editors

Mount editors in the shell's document instead of iframes. Waits for the
`EditorDefinition` revisit in the
[editor host roadmap](../editors/host/ROADMAP.md): `mount` takes a container,
not `document`.

## Performance

Opening an editor tab is measured from the double-click to
`data-editor-state="ready"`, with `jolly-pixel:debug` set to `*` so each boot
step logs its duration. A voxel-map tab opens in about 0.9 s cold and 0.45 s
warm, down from 2.1 s and 0.9 s. A joining client now receives pixel snapshots
as PNG, cached per room version; a cold room reads its log once; voxel-map no
longer waits for its hidden metrics panel. What is left (render on demand,
shared editor chunks, the shared main thread, one catalog per frame) is
planned in [PERFORMANCE.md](./PERFORMANCE.md).

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
