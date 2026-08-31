# Persisting a voxel map

The asset-server integration stores a voxel map as an event-sourced asset. Add
the handler when creating the asset backend:

```ts
import {
  voxelMapAssetHandler
} from "@jolly-pixel/voxel.renderer/asset/index.ts";

await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [
    voxelMapAssetHandler({
      chunkSize: 16
    })
  ]
});
```

`@jolly-pixel/asset-server` and `@jolly-pixel/event-store` are optional peer
dependencies. Import this subpath only from server code.

The handler claims `**/*.voxelmap.json` by default. Documents use the same
`VoxelWorldJSON` shape as `VoxelEngine.save()`.

## Choose persistent or in-memory synchronization

`VoxelSyncServer` holds one world in process memory. It is suitable for an
ephemeral shared world. The asset handler rebuilds state from an event log and
writes snapshots to an asset source.

Both integrations use the same network command protocol, so `VoxelSyncClient`
can connect to either one. Asset rooms derive their room ID from the asset ID;
an in-memory server receives a fixed ID through its constructor.

## Snapshot cadence

The handler waits for a 5-second quiet period and writes at least once every
60 seconds while changes continue. Pass a `snapshot` policy to override those
defaults.

Terrain changes often arrive in bursts, and serializing a large world is more
expensive than serializing an ordinary asset record. The longer default reduces
snapshot churn during editing.

See [voxel-map asset APIs](../api/asset-server/voxel-map-assets.md) for handler
options, state ownership, and the room extension.
