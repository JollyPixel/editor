# VoxelSyncClient

`VoxelSyncClient` connects a `VoxelEngine` to a typed `network.Room`.

## API

```ts
interface VoxelSyncClientOptions {
  room: network.Room<
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
  engine: VoxelEngine;
}

type VoxelAssetNotice =
  | AssetRoomDeletedMessage
  | AssetRoomRejectedMessage;

class VoxelSyncClient extends network.CommandSync<
  VoxelNetworkCommand,
  VoxelWorldJSON,
  VoxelAssetNotice
> {
  constructor(options: VoxelSyncClientOptions);

  replaceWorld(data: VoxelWorldJSON): void;
  destroy(): void;
}
```

The constructor chains onto the engine's current `onLayerUpdated` and `onBlockUpdated` listeners. Construct it before `room.join()` so the first snapshot is applied.

Incoming snapshots call `engine.load()`, then emit `"snapshot"`, and `"ready"` the first time. Incoming mutation commands call `engine.applyRemoteCommand()` and skip commands echoed from the same client. The engine applies them silently, so the command is then replayed to the previous `onLayerUpdated` listener: local observers see a peer's edit exactly as they see a local one, and nothing is sent back to the room.

`"notice"` fires when the room refuses an edit (`rejected`) or the asset is deleted (`deleted`).

`replaceWorld()` sends a stamped administrative command. `destroy()` restores both engine listeners, removes the room message listener, and calls `room.leave()`.

## Block definitions

`onBlockUpdated` is chained the same way as `onLayerUpdated`, so a block edit publishes itself:

```ts
engine.defineBlock(definition);
```

A peer's command is applied through the same `engine.defineBlock()` and `engine.removeBlock()`, without being echoed back to the room. Local and remote edits therefore reach a UI through one hook. A removal naming an unknown ID changes nothing and emits nothing.

See [synchronizing a world](../../guides/synchronizing-a-world.md) for setup.
