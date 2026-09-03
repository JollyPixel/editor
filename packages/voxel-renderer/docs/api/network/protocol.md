# Network protocol

Voxel synchronization uses engine hook events, one administrative command, and
two block-table commands.

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

type VoxelBlockCommand =
  | VoxelBlockDefinedCommand
  | VoxelBlockRemovedCommand;

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
every `engine.defineBlock()` and `engine.removeBlock()`.

`isVoxelBlockCommand()` narrows one, beside `isVoxelNetworkCommand()` in
`VoxelCommandValidator`:

```ts
function isVoxelBlockCommand(
  command: VoxelNetworkCommand
): command is VoxelBlockCommand & network.NetworkCommandHeader;
```

`VOXEL_BLOCK_HOOK_ACTIONS` lists both action names for a rights table.

Block commands are keyed `block:<id>` for conflict resolution, so concurrent
edits contend per block and last write wins.

## Validation

```ts
function isVoxelNetworkCommand(
  value: unknown
): value is VoxelNetworkCommand;
```

The check is deliberately shallow. It verifies only that the value is a
non-null object with `action` and `clientId` properties. Validate untrusted
payloads before they reach `VoxelSyncServer` when the room crosses a trust
boundary.

## Headless application

```ts
world.applyRemoteCommand(command: VoxelLayerHookEvent): void;
```

[`VoxelWorld.applyRemoteCommand()`](../world/VoxelWorld.md#hooks) replays one
mutation against a bare `VoxelWorld` without echoing it back through
`onLayerUpdated`. It is used by the server and is also available to tests,
offline tools, and other headless integrations.
