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

- ZIP import/export that includes the map and its referenced assets. Save JSON
  currently keeps only asset IDs, so tilesets created offline cannot be restored
  after the page is reloaded.
- LocalStorage support to restore browser workspaces, including asset content
  and identities, across page reloads.
