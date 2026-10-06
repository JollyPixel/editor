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

`document` is a `PixelSyncTarget`: `on`/`off` for the `command` event, `applyRemoteCommand()`, and `loadSnapshot()`. The sync client subscribes to `command` alongside any other listener and unsubscribes on `destroy()`. Local edits receive `clientId`, `seq`, and `timestamp` and stay pending until the server acknowledges them; remote edits call `document.applyRemoteCommand()`. The client reconciles them with `createPixelReconciler(document)`: a peer stroke skips the pixels a pending stroke of this client will win, and any other peer command is applied under the pending edits, which are replayed on top. A pending `global-fill`, `resized` or `texture-replaced` cannot be rebased, so the client asks for a snapshot instead. `resolver` in the options must match the room's `conflictResolver`. An undo or redo carries `basis`, the room version of the edit it replays, found from the command's `originTimestamp`: `ReplayBasis` learns it from the stroke's echo, keyed by the stroke's timestamp, and answers `0` when it never saw one. `loadPixelSnapshot(target, snapshot)` decodes a `PixelWireSnapshot` into `loadSnapshot()`: synchronously for base64 pixels, and through a returned promise for PNG pixels. The sync client passes it as `CommandSync`'s `applySnapshot`, so commands that arrive while a PNG decodes are applied after it.

`snapshot` fires after each load; `ready` fires once after the first. `command` reports an applied peer command. `notice` reports a rejected edit or deleted asset. When the room refuses or narrows a `stroke` or `select-edit`, it sends a correction: a `select-edit` holding the authoritative colors of the refused pixels, applied like a peer command. The room follows any other refused or narrowed edit with a snapshot, which replaces what the document applied locally.

`PixelBufferSnapshot` contains `size`, base64 RGBA `pixels`, `uvRegions`, the ten-color `palette`, and `normalMap` when the texture has normal map settings. `PixelWireSnapshot` is the snapshot a room sends: the same fields, with `pixels` either base64 RGBA or `PngPixels`. The room sends PNG pixels to a joining client, from `encodePixelSnapshot(buffer)` through the live protocol's `encodeSnapshot`, and base64 pixels when the buffer changed while encoding. A snapshot replaces the document buffer, UV regions and normal map settings. `PixelNetworkCommand` is a renderer buffer event plus the network command header. `PixelWireCommand` is what travels and is stored: the same commands, with strokes and selection edits allowed in their packed form.

## Commands and canvas hooks

- `stroke` carries a color and pixel positions; `select-edit` carries positions and corresponding colors. Both are sent packed, as flat `xy` positions (`[x0, y0, x1, y1, ...]`) and, for `select-edit`, flat `rgba` channels. The `positions` and `colors` forms stay valid, so older stored events still replay.
- `resized` and `texture-replaced` carry a new size. Replacement also carries pixels. `global-fill` carries source and replacement colors.
- `uv-region-created` and `uv-region-state-changed` carry a full region. Move, rotation, and deletion carry a region ID and action-specific geometry. Applying a deletion also drops the region's normal map zone.
- `palette-color-changed` carries `{ index, color }`: a slot index from `0` to `9` and an RGBA8 color with integer byte channels. Snapshots carry all ten colors; legacy snapshots without them restore defaults. Each slot has its own `palette:<index>` conflict key, using the room resolver for live admission and replay. Selected slots and picker drafts stay local.
- `normal-map-toggled`, `normal-map-defaults-patched`, `normal-map-zone-set` and `normal-map-zone-deleted` change the normal map settings. Payloads are described in the renderer docs.

`PixelArtCanvas` integration uses `canvas.document`: its `command` event for local changes, `applyRemoteCommand()` for accepted peer changes, and `loadSnapshot()` for replacement state. `runLocalRestore(fn)` keeps the changes made inside `fn` local. The renderer owns the exact event and region types.

## Presence

`new PixelCollaboration({ room, canvas, label, color, onRemoteUvDragging? })` attaches cursor, stroke, selection, and UV previews to a canvas. `label(clientId, profile)` and `color(clientId, profile)` supply peer appearance. Call `destroy()` before destroying the canvas; the caller still leaves the room.

Use the individual helpers when an editor needs only some previews:

- `PixelCursorSync` sends cursor movement through `cursor`.
- `PixelStrokeGhostSync` sends an in-progress stroke through `strokeGhost`.
- `SelectionGhostSync` sends the full selection lifecycle through `selectionGhost`.
- `UVGhostSync` sends UV drags and resizes through `uvGhost` as `{ id, face, layout }`: the region as the drag shows it, and the only slot it changes, or `null` for the whole region.

Each helper takes `room` and `canvas`; cursor also needs `label` and `color`, while selection and UV need `color`. `UVGhostSync` also takes `onRemoteRegionDragging(region)`, called with the `UVRegion` of each peer drag on top of the built-in overlay. They replay existing `room.peers` presence on construction. Stroke and UV payloads and selection gesture updates are coalesced per animation frame. A `strokeGhost` frame, `{ from, spans: [{ color, xy }] }`, carries only the pixels added since the previous frame, starting at index `from`. A frame with `from: 0` restarts the stroke, as a line preview does when it moves. A peer that joins mid-stroke sees only the pixels sent after it joined. A preview stays until its peer publishes `null`, which happens when a stroke or UV drag ends, or until the peer leaves. Previews never edit the authoritative buffer. Accepted commands and snapshots clear overlapping or superseded stroke and UV ghosts. A malformed payload, such as a selection rectangle without numeric bounds or a stroke pixel without an RGBA color, clears that peer's preview.


Selection presence has no timeout. Completing a selection, committing a move, resizing,
transforming, deleting texture pixels, undoing or redoing retains the final outline. Shape
selection masks include their holes. Deselecting, leaving select mode, deleting a floating
paste, replacing or resizing the texture, or destroying the synchronizer publishes
`null`. Peer departure removes the outline and floating preview. Selection presence is
scoped to room membership and is excluded from asset snapshots and history.

The helper subscribes to `selection-presence-changed` and immediately publishes
`canvas.selectionPresence` on attachment. Creating, resizing and moving updates are
coalesced per animation frame; stationary states and clears publish immediately and cancel
queued previews. Existing room presence is replayed on construction, room sync and peer
join. Document snapshots rebuild remote selection views from retained presence. Pixel
commands, including overlapping edits from other peers, do not clear selection presence.

`SelectionGhostPayload` is the wire representation. Its phases are `creating` and
`resizing` with a rectangle, `selected` with a rectangle and mask, and `moving` and
`floating` with source and live rectangles, pixels, mask, erase color and `blankSource`.
Masks are `"full"` or base64 bitsets, with each row-major mask bit stored least-significant
bit first. Pixels are base64 row-major RGBA8, preserving alpha-zero RGB bytes. Floating
previews render the owner's pixels and erase color instead of sampling the receiver's
texture. Moving previews erase the source only when `blankSource` is true; floating
paste previews never erase it.

Decoding validates safe integer geometry, positive dimensions, matching source/live sizes,
mask and pixel lengths, selected mask cells and RGBA bytes. Content is limited to the
receiver's `maxTextureSize ** 2` pixels before decoding arrays; creating and resizing
outlines may extend beyond those bounds. Invalid presence clears that peer's selection.
The packed selection format requires peers to use the updated client together.

`peerStyle(room, style)` binds a `PeerColor` or `PeerLabel` to the room's peer profiles and returns `(clientId) => string`.

## Server protocol

`PixelCommandArbiter.admit(state, command)` returns an admission or `null`; a command admitted whole is returned as received, and a narrowed stroke or selection edit is returned packed. `correctPixelCommand(buffer, command, admitted)` builds the correction for the pixels `command` painted and `admitted` did not keep, or returns `null` for commands that paint no pixels. `packPixelEvent(event)` and `unpackPixelCommand(command)` convert between the two forms. `pixelCommandKeys(command)` returns the pixel, UV slot or normal map keys a write sets, or `null` for any other command, and `narrowPixelCommand(command, keep)` keeps the painted entries at `keep`; the arbiter and the client reconciler share both. A committed `resized` or `texture-replaced` supersedes every pixel: a replay from another client must be newer than it. A `global-fill` claims the pixels it repaints, found with `positionsOf` on the server buffer. A normal map patch claims each patched field and a zone command claims its region; a `normal-map-toggled` with valid settings supersedes both, like a replacement does for pixels. `restore(command, version)` records a past command when the room starts; a `global-fill` restores nothing, since its pixels depend on the buffer it ran on. `isPixelCommand(command)` narrows a union that embeds pixel commands, such as a blockset room's. `applyPixelCommand(state, command)` is the fold operation used by the kind handler: it unpacks the command and applies it to a renderer `PixelDocumentState`, the same applier a `PixelDocument` uses, so the server and the clients cannot drift. `pixelCommandProtocol` validates live and replayed commands; `pixelSnapshotSchema` describes snapshots. Conflict keys and the append order are described in [architecture](../ARCHITECTURE.md).

For restricted rooms, use the `pixelart` extension and its command actions in an `@jolly-pixel/network` rights table. Resolve a user's role from a trusted server session; client-supplied identity is metadata. See [network rights](../../../network/docs/Rights.md).

## UV layouts

`uvRegionSchema` validates a UV region. `uvLayoutSchema` validates the same geometry without `id`, `name` and `color`, typed as `UVLayoutData` from `@jolly-pixel/pixel-draw.renderer`, for a document that stores UV regions a texture disowns with `PixelDocument.disownUvRegions()`. `UVRegion.toLayout()` and `UVRegion.fromLayout()` convert between the two. Both schemas are exported from the server entry point.
