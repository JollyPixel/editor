# Network protocol

Voxel synchronization uses engine hook events, one administrative command, and
three block-table commands.

```ts
interface VoxelWorldReplaceCommand {
  action: "world-replace";
  data: VoxelWorldJSON;
}

interface VoxelBlockDefinedCommand {
  action: "block-defined";
  block: ResolvedBlockDefinition;
}

interface VoxelBlockRemovedCommand {
  action: "block-removed";
  blockId: number;
}

interface VoxelBlockMovedCommand {
  action: "block-moved";
  blockId: number;
  toIndex: number;
}

type VoxelBlockCommand =
  | VoxelBlockDefinedCommand
  | VoxelBlockRemovedCommand
  | VoxelBlockMovedCommand;

type VoxelNetworkCommand =
  (VoxelLayerHookEvent | VoxelWorldReplaceCommand | VoxelBlockCommand)
  & network.NetworkCommandHeader;

type VoxelServerMessage = network.NetworkServerMessage<
  VoxelNetworkCommand,
  VoxelWorldJSON
>;
```

`NetworkCommandHeader` supplies `clientId`, `seq`, and `timestamp`. Server
messages contain either a command or a world snapshot.

## Block commands

A block definition belongs to the document, not to a layer, so it carries no
`layerName` and travels on its own hook. `VoxelBlockCommand` is the
`VoxelBlockHookEvent` the engine emits, stamped with a command header, so
[`VoxelSyncClient`](./VoxelSyncClient.md#block-definitions) publishes one for
every `engine.defineBlock()`, `engine.removeBlock()` and `engine.moveBlock()`.

`block-moved` replicates the block table's order, which the document preserves
through its `blocks` array. `toIndex` is absolute, so peers applying the same
sequence of moves in the room's order converge. Two peers moving different
blocks at the same instant do not contend, and their orders can differ until
the next snapshot, matching how `layer-moved` behaves.

`VOXEL_BLOCK_HOOK_ACTIONS` lists every block action name for a rights table.

Block commands are keyed `block:<id>` for conflict resolution, so concurrent
edits contend per block and last write wins.

## Validation

```ts
const voxelCommandProtocol: MessageProtocol;
const voxelWorldSchema: JSONSchema;
```

`voxelCommandProtocol` is the JSON Schema of every `VoxelNetworkCommand`, one
variant per action. The asset room validates live messages and replayed events
against it, and a rights table reads its action names. `voxelWorldSchema`
checks the `VoxelWorldJSON` header only; `parseVoxelDocument()` owns the
document itself.

## Headless application

```ts
world.applyRemoteCommand(command: VoxelLayerHookEvent): void;
```

`VoxelWorld.applyRemoteCommand()` replays one
mutation against a bare `VoxelWorld` without echoing it back through
`onLayerUpdated`. It is used by the server and is also available to tests,
offline tools, and other headless integrations.
