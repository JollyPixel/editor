# Pixel-art network API

Syncs a `PixelDocument` through a `pixelart:<assetId>` room. Browser code imports `@jolly-pixel/asset.pixel-art/client`; asset-server code imports `@jolly-pixel/asset.pixel-art/server`.

```ts
import {
  pixelArtRoom,
  SyncedPixelDocument
} from "@jolly-pixel/asset.pixel-art/client";

const room = pixelArtRoom(client, assetId);
const synced = new SyncedPixelDocument(room);
room.join();
await synced.ready;

// On teardown: synced.dispose(); room.leave();
```

Pending edits, acknowledgements, rebase and resume follow `CommandSync`.

## Document synchronization

- `pixelArtRoom(client, assetId)` returns the typed room. The caller joins and leaves it.
- `new SyncedPixelDocument(room, { maxSize? })` is a network `SyncedDocument`. Its `document` is 1 by 1 until the first snapshot. Create it before `room.join()`.
- `pixelArtDocumentKind(options?)` builds `SyncedPixelDocument`s for an `@jolly-pixel/editor.host` lease.
- `blankPixelDocument(options?)` creates the 1 by 1 document, for a synced document that owns more than pixels (see voxel-map's `SyncedBlockset`).
- `createPixelArtAsset(catalog, path, document)` creates a `pixelart` asset, suffixes a conflicting path, and returns its ID.

### PixelSyncClient

`new PixelSyncClient({ room, document })` syncs a document you already own. It is a `CommandSync`, so it emits `snapshot`, `ready`, `command` and `notice`; call `destroy()` before leaving the room.

- `document` is a `PixelSyncTarget`: the `command` event, `applyRemoteCommand()`, `replayPendingCommand()`, `loadSnapshot()` and a change source.
- Local edits are sent with the `basis` of their [history](./history.md) change, and the server's answers reach the receipts of `pixelEdits(document)`.
- A peer stroke skips the pixels a pending local stroke will win. A pending `global-fill`, `resized` or `texture-replaced` cannot be rebased, so the client asks for a snapshot.
- PNG snapshots decode asynchronously (`loadPixelSnapshot`). Commands that arrive meanwhile are applied after the decode.
- A refused or narrowed `stroke` or `select-edit` is answered with a `select-edit` correction holding the server's colors. Any other refused edit is answered with a snapshot.

`PixelArtCanvas` plugs in through `canvas.document`. `runLocalRestore(fn)` keeps the changes made inside `fn` local.

## Wire data

```ts
interface PixelBufferSnapshot {
  size: Vec2;
  pixels: string; // base64 RGBA8
  uvRegions: UVRegionData[];
  normalMap?: NormalMapData;
  palette?: RGBA8[]; // ten colors
}
```

- `PixelWireSnapshot` is the same snapshot with `pixels` either base64 or `PngPixels`. A joining client gets PNG pixels from `encodePixelSnapshot()`.
- `PixelNetworkCommand` is a renderer buffer event plus the network command header. `PixelWireCommand` is what travels and is stored: strokes and selection edits may be packed as flat `xy` positions and `rgba` channels. `packPixelEvent()` and `unpackPixelCommand()` convert between both.
- `stroke`, `select-edit`, `global-fill`, `resized` and `texture-replaced` edit pixels. The `uv-region-*` commands edit UV regions; deleting one drops its normal map zone.
- `palette-color-changed` carries `{ index, color }` for slots `0` to `9`. A snapshot without a palette restores the defaults.
- The `normal-map-*` commands change normal map settings. The renderer docs describe every payload.

## Presence

`new PixelCollaboration({ room, canvas, color, label?, onRemoteUvDragging? })` shows peers' cursors, strokes, selections and UV drags on a canvas. Call `destroy()` before destroying the canvas.

- `color(clientId, profile)` picks a peer's color. `label` defaults to the profile `username`. `peerStyle(room, style)` binds either one to the room's peer profiles.
- Editors that need only some previews use `PixelCursorSync`, `PixelStrokeGhostSync`, `SelectionGhostSync` or `UVGhostSync`. Each takes `room` and `canvas`, and all but the stroke one take `color`.
- Previews are coalesced per animation frame and never touch the document. A preview stays until its peer publishes `null` or leaves; accepted commands and snapshots clear overlapping stroke and UV previews.
- A selection stays visible until its owner deselects, leaves select mode, deletes a floating paste, or replaces or resizes the texture. It is room presence, never part of snapshots or history.
- A malformed payload clears that peer's preview.

## Server protocol

- `PixelCommandArbiter` is a network `KeyedCommandArbiter` over `PIXEL_COMMAND_RULES`. A narrowed stroke or selection edit is returned packed.
- `resized` and `texture-replaced` reset the pixel keys, and a valid `normal-map-toggled` resets the normal map keys. A `global-fill` claims the pixels it repaints and restores nothing at room start.
- `pixelCommandKeys(command)` and `narrowPixelCommand(command, keep)` are shared by the arbiter and the client reconciler. [Architecture](../ARCHITECTURE.md) lists the keys.
- `correctPixelCommand(buffer, command, admitted)` builds the `select-edit` correction, or returns `null` for commands that paint nothing.
- `applyPixelCommand(state, command)` folds a command into a renderer `PixelDocumentState` with the same applier the clients use.
- `isPixelCommand(command)` narrows a union that embeds pixel commands, such as a blockset room's.
- `pixelCommandProtocol` validates commands and `pixelSnapshotSchema` validates snapshots.
- `uvRegionSchema` validates a UV region. `uvLayoutSchema` validates its geometry alone (`UVLayoutData`), for documents that keep regions a texture disowned.

Restricted rooms use the `pixelart` extension and its command actions in a rights table. Resolve roles from a trusted server session.
