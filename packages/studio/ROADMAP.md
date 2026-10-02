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
