---
status: accepted
---

# Renderers emit plain changes; asset packages own their history

`@jolly-pixel/pixel-draw.renderer` and `@jolly-pixel/voxel.renderer` no longer depend on this
package. A pixel document emits an `EditChange` (command, origin, inverse, peer) and applies an undo
command through `applyStep(command)`; a voxel world reports the cells each write replaced to its
recorders. Everything else moved to the asset package of each document: `pixelEdits()`, the pixel
guards and the canvas histories in `asset.pixel-art`, `VoxelEdits` and the voxel guards in
`asset.voxel-map`. `ChangeSourceAdapter` wraps a plain change source into a history source with
receipts and `basis`.

`VoxelDocument` built its `VoxelEdits` unconditionally, so every game using the engine plugin
shipped this package. `receipts`, `basis` and the peer refusal rules are collaboration policy,
which belongs next to the sync client that writes the receipts.

## Considered Options

- **Keep history in the renderers.** Every change to the guards or receipts was a major release of
  two public packages, and runtime bundles paid for editor undo.
- **A private undo stack in the canvas.** Two undo models again, with different answers to peer
  edits; 0001 removed that.

## Consequences

- `PixelArtCanvasOptions.history` takes a `PixelArtCanvasHistory` the host builds, such as
  `StandalonePixelHistory` or `SharedPixelHistory`.
- A sync client and a history share one source per document: `pixelEdits(document)`, or the
  `VoxelEdits` that `VoxelSyncClient` builds as `sync.edits`.
- The renderers' tests use this package only as a dev dependency.
