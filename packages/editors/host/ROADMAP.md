# @jolly-pixel/editor.host — ROADMAP

## Host shell

A shell (tabs/windows that list assets and open editors) that resolves a
target's kind to an editor module and calls its `mount` itself. Once it exists:

- Revisit the `EditorDefinition` contract, including how embedded panels
  (voxel-map's Paint tab, voxel-model's texture panel) fit, since today they
  take a lease rather than a context.
- Settle the `hostMessage` handshake: an origin allow-list, and whether the
  editor posts a "ready" message before the host sends the launch.
- Opaque launch tokens: a `/edit/<token>` route that resolves to a target, so
  the id stays out of the URL.

## Asset server

- Delete protection: refuse or warn on deleting an asset that still has
  dependents, using the catalog's `dependentsOf` index.

## Editors

- voxel-renderer model/view split, so a voxel-map (and voxel-model) target can
  be leased as a synced model instead of room-only, with the editor keeping
  only the view.

## Offline workspaces

- Import as copy: an optional `rebind(state, idMap)` on `AssetKindHandler`, and
  a third option in the collision dialog.
- Whole-workspace export and import in the UI. If it outgrows the room cap, an
  HTTP streaming endpoint for that case only, with an Origin check.
- Offer offline mode when the socket or catalog is unreachable, and a build
  flag for static hosting.
- Host shell: a per-asset "Export" action and in-place navigation after an
  import.
- A shared-tab workspace over `BroadcastChannel` instead of the tab lock.
- voxel-model and pixel-art have no archive UI yet. The `session.archive` port
  already serves them.
