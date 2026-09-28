# Pixel-art network API

The browser entry point is `@jolly-pixel/asset.pixel-art/client`. Server protocol utilities are exported from `@jolly-pixel/asset.pixel-art/server`. A room represents one asset named `pixelart:<assetId>`.

## Document synchronization

- `pixelArtRoom(client, assetId)` returns the typed room. The caller joins and leaves it.
- `new SyncedPixelDocument(room, options?)` creates a `PixelDocument` and a private `PixelSyncClient`. `document` starts at 1 by 1 until the first snapshot. `ready` resolves after that snapshot and `loaded` reports it; `dispose()` removes listeners while the caller retains room and socket ownership.
- `blankPixelDocument(options?)` creates that 1 by 1 `PixelDocument`, for a synced document that owns more than pixels.
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

`document` is a `PixelSyncTarget`: `on`/`off` for the `buffer-updated` event, `applyRemoteCommand()`, and `loadSnapshot()`. The sync client subscribes to `buffer-updated`, so the document's `onBufferUpdated` hook stays free, and unsubscribes on `destroy()`. Local edits receive `clientId`, `seq`, and `timestamp`. Echoes from the same client are skipped unless a snapshot arrived after the edit was sent; remote edits call `document.applyRemoteCommand()`. `loadPixelSnapshot(target, snapshot)` decodes a `PixelBufferSnapshot` into `loadSnapshot()`.

`snapshot` fires after each load; `ready` fires once after the first. `command` reports an applied peer command. `notice` reports a rejected edit or deleted asset. The room follows a refused or narrowed edit with a snapshot, which replaces what the document applied locally.

`PixelBufferSnapshot` contains `size`, base64 RGBA `pixels`, and `uvRegions`. A snapshot replaces the document buffer and UV regions. `PixelNetworkCommand` is a renderer buffer event plus the network command header.

## Commands and canvas hooks

- `stroke` carries a color and pixel positions; `select-edit` carries positions and corresponding colors.
- `resized` and `texture-replaced` carry a new size. Replacement also carries pixels. `global-fill` carries source and replacement colors.
- `uv-region-created` and `uv-region-state-changed` carry a full region. Move, rotation, and deletion carry a region ID and action-specific geometry.

`PixelArtCanvas` integration uses the document's `buffer-updated` event for local changes, `applyRemoteCommand()` for accepted peer changes, and `loadSnapshot()` for replacement state. `runLocalRestore(fn)` keeps undo and redo changes local while preserving their original edit timestamps. The renderer owns the exact event and region types.

## Presence

`new PixelCollaboration({ room, canvas, label, color, onRemoteUvDragging? })` attaches cursor, stroke, selection, and UV previews to a canvas. `label(clientId, profile)` and `color(clientId, profile)` supply peer appearance. Call `destroy()` before destroying the canvas; the caller still leaves the room.

Use the individual helpers when an editor needs only some previews:

- `PixelCursorSync` sends cursor movement through `cursor`.
- `PixelStrokeGhostSync` sends an in-progress stroke through `strokeGhost`.
- `SelectionGhostSync` sends selection gestures through `selectionGhost`.
- `UVGhostSync` sends UV drags through `uvGhost`.

Each helper takes `room` and `canvas`; cursor also needs `label` and `color`, while selection and UV need `color`. `UVGhostSync` also takes `onRemoteRegionDragging(payload)`, called with each peer drag on top of the built-in overlay. They replay existing `room.peers` presence on construction. Stroke, selection, and UV payloads are coalesced per animation frame. A preview stays until its peer publishes `null`, which happens when a stroke, drag or selection ends, or until the peer leaves. Previews never edit the authoritative buffer. Accepted commands and snapshots clear overlapping or superseded ghosts. A malformed payload, such as a selection rectangle without numeric bounds or a stroke pixel without an RGBA color, clears that peer's preview.

`peerStyle(room, style)` binds a `PeerColor` or `PeerLabel` to the room's peer profiles and returns `(clientId) => string`.

## Server protocol

`PixelCommandArbiter.admit(buffer, command)` returns an admission or `null`; a command admitted whole is returned as received. A committed `resized` or `texture-replaced` supersedes every pixel: a later stroke from another client must be newer than it. `isPixelCommand(command)` narrows a union that embeds pixel commands, such as a tileset room's. `applyCommandToBuffer(buffer, command)` is the fold operation used by the kind handler. `pixelCommandProtocol` validates live and replayed commands; `pixelSnapshotSchema` describes snapshots. Conflict keys and the append order are described in [architecture](../ARCHITECTURE.md).

For restricted rooms, use the `pixelart` extension and its command actions in an `@jolly-pixel/network` rights table. Resolve a user's role from a trusted server session; client-supplied identity is metadata. See [network rights](../../../network/docs/Rights.md).

## UV layouts

`uvRegionSchema` validates a UV region. `uvLayoutSchema` validates the same geometry without `id`, `name` and `color`, typed as `UVLayoutData` from `@jolly-pixel/pixel-draw.renderer`, for a document that stores UV regions a texture disowns with `PixelDocument.disownUvRegions()`. `UVRegion.toLayout()` and `UVRegion.fromLayout()` convert between the two. Both schemas are exported from the server entry point.
