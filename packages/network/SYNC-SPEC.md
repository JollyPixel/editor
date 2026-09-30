# Client reconciliation and resume — SPEC and PLAN

Status, 2026-09-30: R0 to R7 are built.

Source review: "CRDTs & real-time sync in @jolly-pixel/network — review"
(Claude Doc, 2026-09-30).

## Built

Every client converges to the server's state, and a dropped socket
reconnects and resends what the server has not seen. The server stays the
only authority. The docs describe the result:

| Phase | What | Docs |
|---|---|---|
| R0 | Convergence harness (`test/sync/convergence/`, 1,000 seeds per scenario) and the C1–C3 regression tests in the three asset kinds | — |
| R1 | Pending ledger, echo and `acks` as acknowledgements | [CommandSync](./docs/sync/CommandSync.md#pending-ledger) |
| R2, R3 | `CommandReconciler`: keyed fast path, revert–apply–replay, `resync` fallback | [CommandSync](./docs/sync/CommandSync.md#reconciliation) |
| R4 | `Client` reconnect, `join.resume`, `catch-up` message, ledger bound | [Client](./docs/Client.md#reconnecting), [CommandSync](./docs/sync/CommandSync.md#resume) |
| R5 | voxel-map `correctVoxelCommand` | asset.voxel-map `docs/network.md` |
| R6 | Server-order conflicts (event versions, `basis`), tracker `restore`, `global-fill` keys | [Conflicts](./docs/sync/Conflicts.md) |
| R7 | Voxel layer commands address `layerId`; fractional `rank` order keyed `layer-order:<id>`; renames; world format v4 | voxel-renderer `docs/api/world/VoxelWorld.md#layer-ranks` |

Decisions that differ from the first draft:

- `revert()` returns `false` for a command the kind cannot invert, and the
  client asks for a snapshot at once; the snapshot's `acks` say which
  pending commands it holds.
- `narrow()` returning `null` applies the whole remote write, then replays
  the pending writes that outlive it.
- Catch-up is one `catch-up` message, so the client knows when it ends
  before resending. The server waits for the previous connection to leave
  and keeps its last `seq`.
- `VoxelWorld.addRecorder(recorder, { includeUnrecorded })` replaces the
  single recorder slot (Q4).
- The resume limit defaults to 1,000 events, about one 256 by 256 pixel-art
  snapshot of 40-pixel strokes (Q5, one-off measurement).
- R7 broke the world format instead of migrating it (Q6): v4 layers carry
  `rank` in place of `order`, and v3 worlds and pre-R7 events no longer
  load. Object-layer commands still address `layerName`.
- New layers get a UUID; applying `added`, `cloned` or a rename makes the
  name unique, the same way on every peer. `reordered` is gone:
  `moveLayer()` emits a `layer-moved`.

## Known limits

- Opaque commands ask for a snapshot when a rebase meets them: pixel
  `global-fill`, `resized`, `texture-replaced`; tileset `block-moved`;
  voxel-map `removed`, `merged`, `position-rebased`, objects, templates
  and tileset links.
- Two layers moved to the same slot at once get the same rank and sort by
  id. Moving a layer between two tied layers lands it above both.
- An undo or redo whose original was never acknowledged sends `basis: 0`:
  it wins only when the key's last writer is the same client.
- The tracker rebuild starts at the last checkpoint, scheduled snapshots
  included, and skips `global-fill`.
- `basis` and the `catch-up` message are persisted or public protocol and
  stay valid forever.

## Remaining

- **Manual check (R4 exit):** kill the voxel-map dev server's socket,
  restart it, and confirm every stroke survives.
- **Replay cost:** bench a rebase over a long drag's ledger in
  `packages/bench`; batch inbound messages per animation frame if it shows.
- **More inverses** to shrink the opaque list above, starting with voxel-map
  `removed` and `merged`.
- **Editor rename:** the voxel-map editor can rename object layers only;
  voxel layer refs are still keyed by name.
- **Dev data:** reset the voxel-map and studio dev workspaces, whose worlds
  and event logs predate the v4 format.
