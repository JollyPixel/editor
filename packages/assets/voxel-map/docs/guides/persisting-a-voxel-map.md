# Persisting a voxel map

The asset-server integration stores a voxel map as an event-sourced asset. Add
the handler when creating the asset backend:

```ts
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import {
  voxelMapAssetKind
} from "@jolly-pixel/asset.voxel-map";

await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [
    voxelMapAssetKind({
      chunkSize: 16
    })
  ]
});
```

The package installs `@jolly-pixel/asset-server` and
`@jolly-pixel/event-store` as regular dependencies. Import the package root
only from server code.

The handler claims every `.voxelmap.json` path (`VOXEL_MAP_EXTENSION`).
Documents use the same
`VoxelWorldJSON` shape as `VoxelEngine.save()`.

## In-memory worlds

An ephemeral world uses the same handler on a `MemoryAssetSource` and a
`persistence.memory()` event store. Nothing outlives the process. The room ID
is derived from the asset ID in both cases.

## Snapshot cadence

The handler waits for a 5-second quiet period and writes at least once every
60 seconds while changes continue. Pass a `snapshot` policy to override those
defaults.

Terrain changes often arrive in bursts, and serializing a large world is more
expensive than serializing an ordinary asset record. The longer default reduces
snapshot churn during editing.

See [voxel-map asset APIs](../api/voxel-map-assets.md) for handler
options, state ownership, and the room extension.
