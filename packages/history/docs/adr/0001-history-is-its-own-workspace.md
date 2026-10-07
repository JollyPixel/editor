---
status: accepted
---

# History is its own workspace, extracted together with a renderer

`CommandDocument`, `ChangeReceipts` and `CommandHistory` lived in `@jolly-pixel/network/client`
but imported nothing from network besides each other and `@openally/emitt`. They moved to
`@jolly-pixel/history`. Network depends on it for `DocumentSyncClient` and re-exports nothing, so
consumers import history from `@jolly-pixel/history`.

The move was made only together with a renderer migration. The renderers cannot depend on network,
so before the move pixel-draw kept `History`, `HistoryStack` and `EditRecorder`, pixel-art kept a
`ReplayBasis`, and voxel-renderer kept `VoxelHistory`: four undo implementations with different
answers to peer edits and server refusals. pixel-draw moved first, voxel-renderer next.

## Considered Options

- **Keep history in network.** Right as long as only network documents undo.
- **Re-export from network for one release.** Two import paths for one class, for packages that
  all live in this repository.

## Consequences

- One undo model: per-key guards, server refusals reported, replays sent with a `basis`.
- voxel-model records model and texture edits in one history.
