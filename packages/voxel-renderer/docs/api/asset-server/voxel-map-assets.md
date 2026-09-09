# Voxel-map asset APIs

The asset subpath exports the handler, event-sourced state, and network
extension used by `@jolly-pixel/asset-server`.

The subpath also re-exports the voxel document codec, the tileset definition
helpers, and `BlockRegistry` with `blocksFromTileset()`, so a server can seed
a document with its authoritative block set without importing the renderer
entry point.

## `voxelMapAssetHandler`

`voxelMapAssetHandler()` creates the `AssetKindHandler` for persisted voxel
maps.

```ts
const VOXEL_MAP_KIND = "voxelmap";
const VOXEL_MAP_COMMAND = "voxelmap.command";

interface VoxelMapAssetHandlerOptions {
  match?: readonly string[];
  chunkSize?: number;
  snapshot?: SnapshotPolicy;
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

function voxelMapAssetHandler(
  options?: VoxelMapAssetHandlerOptions
): AssetKindHandler<VoxelMapState, VoxelNetworkCommand>;
```

`match` defaults to `["**/*.voxelmap.json"]`; `chunkSize` defaults to `16`.
The default snapshot policy waits for 5 seconds of quiet and has a 60-second
maximum delay.

The handler serializes state with `encodeVoxelDocument()` and returns an
`AssetLiveProtocol` from `live()` for each room binding.

Applied events never escape as exceptions. Malformed asset or command events
are logged and skipped so later events can continue replaying from the last
valid state.

## `VoxelMapState`

`VoxelMapState` owns the headless world, tileset metadata, and block table for
one persisted voxel map.

```ts
class VoxelMapState {
  readonly world: VoxelWorld;
  readonly blocks: BlockRegistry;
  tilesets: TilesetDefinition[];

  constructor(chunkSize: number);
  toJSON(): VoxelWorldJSON;
  load(document: VoxelWorldJSON): void;
  clear(): void;
}
```

`VoxelWorld` owns neither the tileset list nor the block definitions a document
carries, so the state stores all three. `load()` replaces the world, copies
the document's tilesets, and replaces the block table when the document carries
one. `clear()` empties all three.

`toJSON()` serializes the world with the stored tileset and block definitions,
so a block edit survives a restart. Loading a document with a different chunk
size throws `InvalidVoxelDocumentError` and leaves the state unchanged.

## Live protocol

`live()` returns the voxel-map half of an asset room; asset-server's
`AssetRoomExtension` owns the room lifecycle around it.

```ts
function live(
  binding: AssetRoomBinding<VoxelMapState>
): AssetLiveProtocol<VoxelNetworkCommand>;
```

It builds one `VoxelCommandArbiter` per room, snapshots with
`VoxelMapState.toJSON()`, and appends accepted commands under
`VOXEL_MAP_COMMAND`. The handler's `apply()` function is the only code that
mutates state. Applying a command in the room as well would replay it twice;
an offset delta would then move a layer twice as far.

Full-world replacement bypasses arbitration and broadcasts a fresh snapshot
instead of the command. Other accepted commands are recorded by
`VoxelCommandArbiter` after the event-store append succeeds.

`VOXEL_MAP_ACTIONS` covers the layer hook actions, `VOXEL_BLOCK_HOOK_ACTIONS`
and `world-replace`. Block commands are appended, folded into
`VoxelMapState.blocks`, and broadcast like any other command.
