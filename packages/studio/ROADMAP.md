# @jolly-pixel/studio — ROADMAP

Open work, in the order it should land. Decisions already taken are in the
[ADRs](./docs/adr/README.md). Each step ends with
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

The goal of the first three steps is kinds and editors loaded from outside
the monorepo (a project folder, a package in `node_modules`), keeping
[ADR-0002](./docs/adr/0002-the-shell-consumes-data-only.md): kind code stays
in back-end handlers, editor code stays in iframes.

## 1. New asset from the shell

- Catalog `create` accepts a path and a kind without content; the back-end
  writes the handler's `serialize(create(id))`, as seeding does. Protocol
  schema, `CatalogClient.create` and asset-server docs updated.
- `<asset-browser>` gains a New action per registered kind, labelled and
  iconed from the descriptor, named with the kind's extension. The extension
  joins `AssetKindDescriptor` so the shell never reads a handler.
- A new texture or tileset gets the handler's `defaultSize`, which now only
  sizes assets created without content.
- Tests: asset-server creates a contentless asset of each built-in kind and
  rejects an unknown kind; the browser action sends the command.
- Exit: create a map, a model and a texture from the tree and open each.

## 2. Boot tracing

`mountStandalone`, the session open, `Runtime.create`, the bootstrap steps
and the scene's ready promise log through the host logger, so a silent boot
hang inside a frame no longer needs temporary `console.log` calls.

## 3. `project.json`

- `project/.jollypixel/project.json` lists the editor packages and the kind
  packages. The Vite config reads it instead of hard-coded lists; the
  handler list comes from the kind packages (one factory export per package,
  taking the project's options).
- The editors' own Vite configs and offline workspaces keep their private
  lists until they open a project the same way. Until then, handler
  registration stays duplicated between the studio and each editor.
- Tests: a project file resolves editors and kinds; a missing package or a
  kind claimed twice fails with the package named.

## 4. External kinds and editors

- Resolve packages from the project folder's `node_modules`, not only the
  studio's, and descriptors or editors from a local folder.
- Replace the `virtual:jolly-pixel/editors` build-time module with a served
  manifest (`/editors.json` plus descriptors), so adding an editor needs no
  studio rebuild. The registry and the manifest shapes stay the same.
- Settle trust: an external editor runs same-origin in an iframe today, with
  full access to the shell's storage and back-end session.

## 5. Identity in the launch message

The shell already prompts once and editor frames read the stored name from
`sessionStorage`, but each frame mints its own peer id. Carrying the identity
in `jolly-launch` gives one user one presence color across tabs.

## 6. Authentication

The shell logs in once, the launch message carries a token, and the network
`AuthenticationProvider` checks it on upgrade. Editors never learn how the
identity was obtained.

## 7. Preferences and settings pane

A per-user store the shell owns, reached from the header toolbar. The open
tabs, the dock layout and the kind filter move there from `localStorage`.

## 8. Runtime tab

Another page in another iframe that plays the project. No editor contract
involved; its action goes in the header toolbar.

## 9. In-process editors

Mount editors in the shell's document instead of iframes. Waits for the
`EditorDefinition` revisit in the
[editor host roadmap](../editors/host/ROADMAP.md): `mount` takes a container,
not `document`.

## Waiting for a trigger

- **A first shell command caller.** `context.shell` has no caller since the
  voxel-map Paint action was dropped. Title and dirty state are the expected
  next commands; add them when an editor needs the shell to show either.
