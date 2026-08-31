# VoxelSyncClient

`VoxelSyncClient` connects a `VoxelEngine` to a typed `network.Room`.

## API

```ts
interface VoxelSyncClientOptions {
  room: network.Room<
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
}

class VoxelSyncClient extends network.SyncAdapter<
  VoxelEngine,
  VoxelLayerHookEvent,
  VoxelNetworkCommand,
  VoxelWorldJSON
> {
  constructor(options: VoxelSyncClientOptions);

  attach(engine: VoxelEngine): void;
  detach(): void;
  replaceWorld(data: VoxelWorldJSON): void;
  destroy(): void;
}
```

`attach()` chains onto the engine's current `onLayerUpdated` listener. `detach()`
restores the listener that was present at attachment time.

Incoming snapshots call `engine.load()`. Incoming mutation commands call
`engine.applyRemoteCommand()` and skip commands echoed from the same client.
`replaceWorld()` sends a stamped administrative command. `destroy()` detaches,
removes the room message listener, and calls `room.leave()`.

See [synchronizing a world](../../guides/synchronizing-a-world.md) for setup.
