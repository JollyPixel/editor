# Voxel-map asset kind

`@jolly-pixel/voxel.renderer/asset/index.ts` supplies an `AssetKindHandler`
for `@jolly-pixel/asset-server`, so a voxel map becomes a catalogued,
event-sourced, persisted asset instead of a world held in server memory.

```ts
import { voxelMapAssetHandler } from "@jolly-pixel/voxel.renderer/asset/index.ts";

await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [voxelMapAssetHandler({ chunkSize: 16 })]
});
```

`@jolly-pixel/asset-server` and `@jolly-pixel/event-store` are optional peer
dependencies of this package. Import the subpath only from server code.

## How it differs from VoxelSyncServer

| | `VoxelSyncServer` | `voxelMapAssetHandler` |
|---|---|---|
| World lifetime | process memory | replayed from the event log |
| Persistence | none | snapshotted to the asset source |
| Room id | fixed, passed as `id` | `voxelmap:${assetId}`, resolved on join |
| Who writes the world | the extension | `apply`, folding appended events |

The wire protocol is identical, so `VoxelSyncClient` works unchanged against
either. Use `VoxelSyncServer` for a single ephemeral world; use the asset kind
when the map is a file people expect to still be there tomorrow.

Both share `VoxelCommandArbiter`, which resolves conflicts without touching a
world. That separation is what lets the asset room append rather than mutate.

## Documents

The kind matches `**/*.voxelmap.json` by default and stores `VoxelWorldJSON`,
the same shape `serializeVoxelWorld()` produces.

`VoxelMapState` is the handler's state: a `VoxelWorld` plus the `tilesets` a
document carries but a world does not. A document's tileset list is restored on
load and written back on snapshot; without it, every save would drop the list
the file arrived with.

```ts
class VoxelMapState {
  readonly world: VoxelWorld;
  tilesets: TilesetDefinition[];

  constructor(chunkSize: number);
  // Snapshots the world and its tilesets as a document.
  toJSON(): VoxelWorldJSON;
  // Restores both from one, replacing whatever the state held.
  load(document: VoxelWorldJSON): void;
  // Empties the world and drops the tileset list.
  clear(): void;
}
```

A document whose `chunkSize` differs from the handler's is refused rather
than loaded into a mismatched world. Validation and byte encoding both come
from `serialization/`: `parseVoxelDocument`, `encodeVoxelDocument` and
`decodeVoxelDocument` are re-exported from `asset/index.ts` for convenience.

## Snapshot cadence

Defaults to a 5s quiet period and a 60s maximum, slower than the back-end's
2s/30s: terrain edits arrive in bursts and a large world is expensive to
serialize. Override with `snapshot`.

## Why the room never writes

`apply` is the only writer. A room that mutated the world *and* appended
would apply every command twice. Most commands are absolute writes and would
survive that, but `offset-updated` carries a `delta`. Applying it twice
moves the layer twice as far. Live state and a cold replay would then
disagree and break event-source consistency.

`world-replace` skips arbitration because a full-state overwrite always wins.
It is appended like any other command so a replay reproduces it. Every peer
then receives a fresh snapshot.

## Errors

`apply` never throws. Its event is already persisted, so a fold that aborted
would break every later replay. A malformed document, or a command naming a
layer the world no longer holds, is logged and skipped, leaving the last good
world in place.
