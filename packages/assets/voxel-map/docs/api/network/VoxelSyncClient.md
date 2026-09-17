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

The constructor subscribes to the engine's `"command"` event and sends every command whose origin is `"local"`. Other listeners are left alone. Construct it before `room.join()` so the first snapshot is applied.

Incoming snapshots call `engine.load()`, then emit `"snapshot"`, and `"ready"` the first time. Incoming commands, except `world-replace`, go through `engine.apply(command, { origin: "remote" })`, and commands echoed from the same client are skipped. Local listeners therefore see a peer's edit once, tagged `"remote"`, and nothing is sent back to the room.

`"notice"` fires when the room refuses an edit (`rejected`) or the asset is deleted (`deleted`).

`replaceWorld()` sends a stamped administrative command. `destroy()` unsubscribes from the engine, removes the room message listener, and calls `room.leave()`.

## Block definitions

A block edit made through the engine publishes itself:

```ts
engine.defineBlock(definition);
```

A peer's block command goes through `engine.apply()` and is not echoed back to the room. Local and remote edits therefore reach a UI through the same `"command"` event. A removal naming an unknown ID changes nothing and emits nothing.

## Tilesets

The document's tileset list lives in `engine.tilesets`: a snapshot replaces it through `engine.load()`, and a local change publishes itself:

```ts
engine.addTileset({ id: "stone", src: assetId, tileSize: 16 });
```

A peer's [tileset command](./protocol.md#tileset-commands) goes through `engine.apply()` without being echoed back. Loading a tileset's texture stays with the caller, through `engine.loadTileset()`.

See [synchronizing a world](../../guides/synchronizing-a-world.md) for setup.
