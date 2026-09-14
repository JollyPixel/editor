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
  blocks?: BlockRegistry;
}

class VoxelSyncServer extends network.Extension {
  readonly id: string;
  readonly name: "voxel.renderer";
  readonly world: VoxelWorld;
  readonly blocks: BlockRegistry;
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
with `chunkSize`, which defaults to `16`. When `blocks` is omitted, the server
creates an empty registry.

`onClientConnect()` sends the current snapshot. `onMessage()` performs the
shallow command-marker check before calling `receive()`.

`receive()` drops a voxel mutation whose layer no longer exists, which is a
normal race when a peer removes a layer mid-edit: nothing is applied and
nothing is broadcast. Any other invalid command throws, and the transport
(`Server`) drops that envelope and logs it with its client and room. A command
that throws is neither recorded by the conflict tracker nor broadcast.

`name` provides the rights namespace. `events` contains the layer hook action
vocabulary plus `VOXEL_BLOCK_HOOK_ACTIONS`, but excludes `"world-replace"`.
`snapshot()` serializes the world with its block definitions and without
tileset metadata.

Block commands are folded into `blocks` and broadcast. A world replacement
leaves the registry alone unless the document carries a block table, in which
case that table replaces it.
