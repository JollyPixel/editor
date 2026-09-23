# Voxel-map network API

The browser entry point is `@jolly-pixel/asset.voxel-map/network/client.ts`. Server protocol utilities are exported from `@jolly-pixel/asset.voxel-map/network/server.ts`. Use `assetRoomName("voxelmap", assetId)` to name the room.

## Document synchronization

`new VoxelSyncClient({ room, document })` connects a `VoxelDocument` to a `VoxelMapRoom`. Construct it before `room.join()`. It sends document commands with a local origin and applies peer commands with a remote origin. Snapshots call `document.load()`. `replaceWorld(data)` sends a full `VoxelWorldJSON` replacement; the server broadcasts a fresh snapshot after applying it.

`destroy()` removes the document and room listeners. The caller still leaves the room and owns the shared network client. The inherited `snapshot`, `ready`, `command`, and `notice` events report loaded snapshots, the first load, peer commands, and rejected or deleted asset notices.

`SyncedVoxelMap(room, options?)` creates a `VoxelDocument` as `voxels` with a private sync client. Its `ready` promise resolves after the first snapshot; `loaded` reports readiness. `replaceWorld(data)` and `dispose()` delegate to the sync client. `voxelMapDocumentKind(options?)` provides the corresponding `@jolly-pixel/editor.host` lease adapter. Options can set `chunkSize`, initial `layers` and `blocks`, `history`, and `logger`.

## Wire data

`VoxelNetworkCommand` is a renderer `VoxelCommand` or a `world-replace` command, plus `NetworkCommandHeader` (`clientId`, `seq`, `timestamp`). `VoxelServerMessage` carries a command, a `VoxelWorldJSON` snapshot, or an asset notice. The snapshot includes world content, block definitions, tilesets, and default tile size.

Renderer commands cover voxels and layers, objects, block definitions, and tilesets. Local calls such as `document.defineBlock()` or `document.addTileset()` emit commands that the sync client sends. A peer's edit goes through `document.apply(command, { origin: "remote" })`. Texture resource loading remains with the client.

`world-replace` is the additional administrative command. It is always admitted and produces a snapshot broadcast. The renderer's [command reference](../../../voxel-renderer/docs/api/core/commands.md) defines the other command payloads.

## Server protocol

`VoxelCommandArbiter.admit(command)` returns an admission or `null`. Bulk `voxels-set`, `voxels-removed` and `voxels-patched` commands may be narrowed to the cells that win; a patch whose length is not a whole number of cells is rejected. `key(command)` returns one collision key or `null`; `keys(command)` returns all keys, including each cell in a bulk command. The [architecture page](../ARCHITECTURE.md) lists the key rules.

`voxelCommandProtocol` validates command messages. `voxelWorldSchema` checks the snapshot header; the renderer parses the full document. `VoxelMapState.applyCommand()` applies commands to the headless world, block registry, and tileset list.

Access policies use the `voxelmap` extension and protocol action names such as `voxel-set` and `block-defined`. Resolve roles from a trusted server session when access control matters. See [network rights](../../../network/docs/Rights.md).
