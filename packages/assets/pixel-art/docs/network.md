# Pixel-art network API

The browser entry point is `@jolly-pixel/asset.pixel-art/network/client.ts`. Server protocol utilities are exported from `@jolly-pixel/asset.pixel-art/network/server.ts`. A room represents one asset named `pixelart:<assetId>`.

## Document synchronization

- `pixelArtRoom(client, assetId)` returns the typed room. The caller joins and leaves it.
- `new SyncedPixelDocument(room, options?)` creates a `PixelDocument` and `PixelSyncClient`. `document` starts at 1 by 1 until the first snapshot. `ready` resolves after that snapshot; `dispose()` removes listeners while the caller retains room and socket ownership.
- `pixelArtDocumentKind(options?)` adapts synced documents to an `@jolly-pixel/editor.host` asset lease.
- `createPixelArtAsset(catalog, path, document)` encodes a `PixelArtDocumentData`, creates a `pixelart` asset, suffixes a conflicting path, and returns the asset ID.

`SyncedPixelDocumentOptions` accepts `maxSize` and `history: { enabled?, limit? }`. Create the document before `room.join()`, since the server sends a snapshot on join.

`PixelSyncClient` can also attach to an existing document:

```ts
const sync = new PixelSyncClient({ room, document });
room.join();
sync.on("notice", (notice) => console.warn(notice.type));

// On teardown: sync.destroy(); room.leave();
```

`document` needs `onBufferUpdated`, `applyRemoteCommand()`, and `loadSnapshot()`. The sync client chains the previous buffer hook and restores it on `destroy()`. Local edits receive `clientId`, `seq`, and `timestamp`. Echoes from the same client are skipped; remote edits call `document.applyRemoteCommand()`.

`snapshot` fires after each load; `ready` fires once after the first. `command` reports an applied peer command. `notice` reports a rejected edit or deleted asset.

`PixelBufferSnapshot` contains `size`, base64 RGBA `pixels`, and `uvRegions`. A snapshot replaces the document buffer and UV regions. `PixelNetworkCommand` is a renderer buffer event plus the network command header.

## Commands and canvas hooks

- `stroke` carries a color and pixel positions; `select-edit` carries positions and corresponding colors.
- `resized` and `texture-replaced` carry a new size. Replacement also carries pixels. `global-fill` carries source and replacement colors.
- `uv-region-created` and `uv-region-state-changed` carry a full region. Move, rotation, and deletion carry a region ID and action-specific geometry.

`PixelArtCanvas` integration uses `document.onBufferUpdated` for local changes, `applyRemoteCommand()` for accepted peer changes, and `loadSnapshot()` for replacement state. `runLocalRestore(fn)` keeps undo and redo changes local while preserving their original edit timestamps. The renderer owns the exact event and region types.

## Presence

`new PixelCollaboration({ room, canvas, label, color, onRemoteUvDragging? })` attaches cursor, stroke, selection, and UV previews to a canvas. `label(clientId, profile)` and `color(clientId, profile)` supply peer appearance. Call `destroy()` before destroying the canvas; the caller still leaves the room.

Use the individual helpers when an editor needs only some previews:

- `PixelCursorSync` sends cursor movement through `cursor`.
- `PixelStrokeGhostSync` sends an in-progress stroke through `strokeGhost`.
- `SelectionGhostSync` sends selection gestures through `selectionGhost`.
- `UVGhostSync` sends UV drags through `uvGhost`.

Each helper takes `room` and `canvas`; cursor also needs `label` and `color`, while selection and UV need `color`. They replay existing `room.peers` presence on construction. Stroke, selection, and UV payloads are coalesced per animation frame and expire after 1.5 seconds without an update. Previews never edit the authoritative buffer. Accepted commands and snapshots clear overlapping or superseded ghosts; a malformed cursor value or departed peer clears its cursor.

## Server protocol

`PixelCommandArbiter.admit(buffer, command)` returns an admission or `null`. `applyCommandToBuffer(buffer, command)` is the fold operation used by the kind handler. `pixelCommandProtocol` validates live and replayed commands; `pixelSnapshotSchema` describes snapshots. Conflict keys and the append order are described in [architecture](../ARCHITECTURE.md).

For restricted rooms, use the `pixelart` extension and its command actions in an `@jolly-pixel/network` rights table. Resolve a user's role from a trusted server session; client-supplied identity is metadata. See [network rights](../../../network/docs/Rights.md).
