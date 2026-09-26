# Voxel-map network API

The browser entry point is `@jolly-pixel/asset.voxel-map/client`. Server protocol utilities are exported from `@jolly-pixel/asset.voxel-map/server`. Use `assetRoomName("voxelmap", assetId)` to name a map room and `tilesetRoom(client, assetId)` to open a tileset room.

## Map synchronization

`new VoxelSyncClient({ room, document })` connects a `VoxelDocument` to a `VoxelMapRoom`. Construct it before `room.join()`. It sends the document's world commands with a local origin and applies peer commands with a remote origin. Block and material group commands the document emits stay local: they are projected from tileset documents, which have rooms of their own. Snapshots call `document.load()`. `replaceWorld(data)` sends a full `VoxelWorldJSON` replacement; the server broadcasts a fresh snapshot after applying it.

`destroy()` removes the document and room listeners. The caller still leaves the room and owns the shared network client. The inherited `snapshot`, `ready`, `command`, and `notice` events report loaded snapshots, the first load, peer commands, and rejected or deleted asset notices.

`SyncedVoxelMap(room, options?)` creates a `VoxelDocument` as `voxels` with a private sync client. Its `ready` promise resolves after the first snapshot; `loaded` reports readiness. `replaceWorld(data)` and `dispose()` delegate to the sync client. `voxelMapDocumentKind(options?)` provides the corresponding `@jolly-pixel/editor.host` lease adapter. Options can set `chunkSize`, initial `layers` and `blocks`, `history`, and `logger`.

## Tileset synchronization

`new TilesetSyncClient({ room, pixels, tileset })` connects a `PixelDocument` and a renderer `TilesetDocument` to a `TilesetRoom`. Pixel edits go out through the pixel document's buffer hook; block, material group and tile size commands go out from the tileset document's local `command` events. A peer's pixel command is applied with `pixels.applyRemoteCommand()`, any other with `tileset.apply(command, { origin: "remote" })`. A snapshot loads the document, then the pixels, so a snapshot with an invalid block loads neither. `destroy()` restores the buffer hook and removes the listeners.

`SyncedTileset(room, options?)` creates the `pixels` and `tileset` documents with a private sync client; `ready` resolves after the first snapshot and `dispose()` tears both down. Options can set the pixel document's `maxSize` and `history`. `tilesetDocumentKind(options?)` provides the lease adapter. `createTilesetAsset(catalog, path, document)` creates a tileset asset from a `TilesetAssetDocument`, suffixing the path on conflict.

## Wire data

`VoxelNetworkCommand` is a renderer `VoxelWorldCommand` (layer, voxel, object and tileset link commands) or a `world-replace` command, plus `NetworkCommandHeader` (`clientId`, `seq`, `timestamp`). `VoxelServerMessage` carries a command, a `VoxelWorldJSON` snapshot, or an asset notice. The snapshot holds the layers and the tileset links; a link names an asset, or a URL with its tile size, and the slot the tileset's block ids occupy.

`TilesetNetworkCommand` is a pixel-art `PixelNetworkCommand` or a renderer `TilesetDocumentCommand` (`block-defined`, `block-removed`, `block-moved`, `material-group-defined`, `material-group-removed`, `tile-size-updated`) plus the header. `TilesetServerMessage` carries a command, a `TilesetSnapshot` (`tileSize`, `pixels`, `blocks`, `materialGroups`), or an asset notice. `isPixelNetworkCommand(command)` tells the two apart.

`world-replace` is the additional administrative command. It is always admitted and produces a snapshot broadcast. A `tileset-added` the server could not link at the slot it names, because another client took that slot first, also produces a snapshot broadcast so the sender drops its local link. The renderer's [command reference](../../../voxel-renderer/docs/api/core/commands.md) defines the other command payloads.

## Server protocol

`VoxelCommandArbiter.admit(command)` returns an admission or `null`. Bulk `voxels-set`, `voxels-removed` and `voxels-patched` commands may be narrowed to the cells that win; a patch whose length is not a whole number of cells is rejected. `key(command)` returns one collision key or `null`; `keys(command)` returns all keys, including each cell in a bulk command.

`TilesetCommandArbiter.admit(state, command)` hands pixel commands to a `PixelCommandArbiter` over `state.pixels` and keys document commands per block, material group or tile size; `key(command)` returns that key. A `block-defined` whose block the renderer `localBlock()` refuses is rejected. The [architecture page](../ARCHITECTURE.md) lists the key rules of both rooms.

`voxelCommandProtocol` and `tilesetCommandProtocol` validate command messages. `voxelWorldSchema` and `tilesetSnapshotSchema` check the snapshot headers; `voxelWorldSchema` also checks a stored map before the renderer parses the full world document. `VoxelMapState.applyCommand()` applies commands to the headless world and tileset list; `TilesetState.applyCommand()` applies them to the pixel buffer or the tileset document.

Access policies use the `voxelmap` and `tileset` extensions and protocol action names such as `voxel-set`, `stroke` and `block-defined`. Resolve roles from a trusted server session when access control matters. See [network rights](../../../network/docs/Rights.md).
