# VoxelSyncServer

`VoxelSyncServer` is a `network.Extension` that owns one authoritative
`VoxelWorld`.

## API

```ts
type ClientHandle = network.ClientHandle;

interface VoxelSyncServerOptions {
  id?: string;
  world?: VoxelWorld;
  chunkSize?: number;
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

class VoxelSyncServer extends network.Extension {
  readonly id: string;
  readonly name: "voxel.renderer";
  readonly world: VoxelWorld;
  readonly events: readonly string[];

  constructor(options?: VoxelSyncServerOptions);
  onClientConnect(client: ClientHandle): void;
  onClientDisconnect(clientId: string): void;
  getEventName(payload: unknown): string;
  onMessage(
    clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): void;
  receive(
    command: VoxelNetworkCommand,
    context: network.RoomContext
  ): void;
  snapshot(): VoxelWorldJSON;
}
```

`id` defaults to `"voxel-map"`. When `world` is omitted, the server creates one
with `chunkSize`, which defaults to `16`.

`onClientConnect()` sends the current snapshot. `onMessage()` performs the
shallow command-marker check before calling `receive()`. Invalid mutations and
world replacements are logged and dropped.

`name` provides the rights namespace. `events` contains the layer hook action
vocabulary but excludes `"world-replace"`. `snapshot()` serializes the world
without tileset metadata or block definitions.
