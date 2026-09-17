# Network protocol

Voxel synchronization sends the renderer's [`VoxelCommand`](../../../../../voxel-renderer/docs/api/core/commands.md)
union plus one administrative command.

```ts
interface VoxelWorldReplaceCommand {
  action: "world-replace";
  data: VoxelWorldJSON;
}

type VoxelNetworkCommand =
  (
    | VoxelCommand
    | VoxelWorldReplaceCommand
  )
  & network.NetworkCommandHeader;

type VoxelServerMessage = network.NetworkServerMessage<
  VoxelNetworkCommand,
  VoxelWorldJSON
>;
```

`NetworkCommandHeader` supplies `clientId`, `seq`, and `timestamp`. Server
messages contain either a command or a world snapshot.

## Block commands

A block definition belongs to the document, not to a layer, so a
[`VoxelBlockCommand`](../../../../../voxel-renderer/docs/api/core/commands.md#block-commands) carries no `layerName`.
[`VoxelSyncClient`](./VoxelSyncClient.md#block-definitions) publishes one for
every `engine.defineBlock()`, `engine.removeBlock()` and `engine.moveBlock()`.

`block-moved` replicates the block table's order, which the document preserves
through its `blocks` array. `toIndex` is absolute, so peers applying the same
sequence of moves in the room's order converge. Two peers moving different
blocks at the same instant do not contend, and their orders can differ until
the next snapshot, matching how `layer-moved` behaves.

`VOXEL_BLOCK_COMMAND_ACTIONS` lists every block action name for a rights table.

Block commands are keyed `block:<id>` for conflict resolution, so concurrent
edits contend per block and last write wins.

## Tileset commands

A [`VoxelTilesetCommand`](../../../../../voxel-renderer/docs/api/core/commands.md#tileset-commands) is stamped with a command
header like any other, so [`VoxelSyncClient`](./VoxelSyncClient.md#tilesets)
publishes one for every `engine.addTileset()`, `engine.removeTileset()`,
`engine.resizeTileset()` and `engine.defaultTileSize` assignment.
`VoxelMapState` and the engine both fold them with the renderer's
[`applyTilesetCommand()`](../../../../../voxel-renderer/docs/api/tilesets/tilesets.md#tileset-commands),
so every peer applies the same result from one command, including the block
rescale of `tileset-resized`.

`VOXEL_TILESET_COMMAND_ACTIONS` lists every tileset action name for a rights
table.

Tile sizes are integers from 1 to `MAX_TILE_SIZE` (4096); the protocol
rejects anything else. Tileset commands are keyed `tileset:<id>`, and
`default-tile-size-updated` is keyed `default-tile-size`.

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

`VoxelMapState.applyCommand()` loads a `world-replace` snapshot and passes
every other command to the renderer's
[`applyVoxelCommand()`](../../../../../voxel-renderer/docs/api/core/commands.md#applying-commands), which mutates a bare world,
block registry and tileset list without emitting anything. Tests, offline tools
and other headless integrations can call it the same way.
