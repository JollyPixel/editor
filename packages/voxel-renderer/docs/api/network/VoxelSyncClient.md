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
`engine.applyRemoteCommand()` and skip commands echoed from the same client. The
engine applies them silently, so the command is then replayed to the listener
captured at attachment: local observers see a peer's edit exactly as they see a
local one, and nothing is sent back to the room.
`replaceWorld()` sends a stamped administrative command. `destroy()` detaches,
removes the room message listener, and calls `room.leave()`.

## Block definitions

`attach()` chains `onBlockUpdated` the same way it chains `onLayerUpdated`, so
a block edit publishes itself:

```ts
engine.defineBlock(definition);
```

A peer's command is applied through the same `engine.defineBlock()` and
`engine.removeBlock()`, without being echoed back to the room. Local and remote
edits therefore reach a UI through one hook. A removal naming an unknown ID
changes nothing and emits nothing.

`detach()` restores whatever `onBlockUpdated` the engine carried before.

See [synchronizing a world](../../guides/synchronizing-a-world.md) for setup.
