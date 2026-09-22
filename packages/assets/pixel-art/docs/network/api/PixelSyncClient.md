# PixelSyncClient

Connects one `PixelDocument` to one `@jolly-pixel/network` room. No canvas is needed; any `PixelArtCanvas` built on the document shows the synced state. It extends the network package's [`CommandSync`](../../../../../network/docs/sync/CommandSync.md).

## Constructor

```ts
new PixelSyncClient(options: PixelSyncClientOptions)

interface PixelSyncClientOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  document: PixelSyncTarget;
}

type PixelSyncTarget = Pick<
  PixelDocument,
  "onBufferUpdated" | "applyRemoteCommand" | "loadSnapshot"
>;
```

The constructor chains `document.onBufferUpdated` and starts listening for room messages. It does not join or leave the room, so construct it before `room.join()`.

## Types

```ts
type PixelNetworkCommand =
  PixelBufferHookEvent & NetworkCommandHeader;

interface PixelBufferSnapshot {
  size: Vec2;
  pixels: string;
  uvRegions: UVRegionData[];
}

type PixelAssetNotice =
  | AssetRoomDeletedMessage
  | AssetRoomRejectedMessage;

type PixelServerMessage = NetworkServerMessage<
  PixelNetworkCommand,
  PixelBufferSnapshot,
  PixelAssetNotice
>;
```

`pixels` contains base64-encoded RGBA bytes. `PixelNetworkCommand` accepts the actions listed in [canvas integration](./CanvasIntegration.md#mutation-commands).

## Events

| Event | Payload | When |
|---|---|---|
| `"snapshot"` | `PixelBufferSnapshot` | every snapshot, after `document.loadSnapshot()` |
| `"ready"` | none | once, after the first snapshot |
| `"command"` | `PixelNetworkCommand` | a command from another client, after `document.applyRemoteCommand()` |
| `"notice"` | `PixelAssetNotice` | the room refused an edit (`rejected`) or the asset was deleted (`deleted`) |

`ready` is `true` once the first snapshot has been applied.

## Local edits

Local commands receive an incrementing `seq`, the room's `clientId`, and a timestamp. Undo and redo use the original edit timestamp. Commands echoed from the local `clientId` are ignored.

## `destroy()`

Restores the previous `document.onBufferUpdated` listener and removes the room listener. It does not call `room.leave()`.

## SyncedPixelDocument

A `PixelDocument` plus the `PixelSyncClient` that keeps it in step with one room:

```ts
new SyncedPixelDocument(
  room: Room<PixelNetworkCommand, PixelServerMessage>,
  options?: SyncedPixelDocumentOptions
)

interface SyncedPixelDocumentOptions {
  maxSize?: number;
  history?: { enabled?: boolean; limit?: number; };
}
```

- `document` is the document. It starts at 1×1 and takes its size from the first snapshot.
- `sync` is the `PixelSyncClient`.
- `ready` resolves once the first snapshot is loaded.
- `dispose()` destroys the sync client. It does not leave the room.

## pixelArtDocumentKind

```ts
function pixelArtDocumentKind(
  options?: SyncedPixelDocumentOptions
): {
  kind: "pixelart";
  createDocument(room): SyncedPixelDocument;
};
```

The asset document kind that an `@jolly-pixel/editor.host` session leases pixel-art assets with. Every lease of one asset shares the same document.

## PixelCollaboration

Builds every presence helper for one canvas. The canvas should be built on a synced document, and `room` is that document's room:

```ts
new PixelCollaboration(options: {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
  label: PeerLabel;
  color: PeerColor;
  onRemoteUvDragging?: (payload: UVGhostPayload) => void;
})

type PeerLabel = (clientId: string, profile: PeerMetadata) => string;
type PeerColor = (clientId: string, profile: PeerMetadata) => string;
```

- `label` and `color` are required and apply to cursors, and `color` to selection and UV ghosts. The host owns peer identity.
- `onRemoteUvDragging` forwards to `UVGhostSync`'s option of the same name (see [PresenceSync](./PresenceSync.md#uvghostsync)).
- `destroy()` destroys every helper. It does not leave the room.
