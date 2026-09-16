# PixelSyncClient

Connects one `PixelArtCanvas` to one `@jolly-pixel/network` room. It extends the network package's [`CommandSync`](../../../../../network/docs/sync/CommandSync.md).

## Constructor

```ts
new PixelSyncClient(options: PixelSyncClientOptions)

interface PixelSyncClientOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
}
```

The constructor chains `canvas.onBufferUpdated` and starts listening for room messages. It does not join or leave the room, so construct it before `room.join()`.

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
| `"snapshot"` | `PixelBufferSnapshot` | every snapshot, after `canvas.loadSnapshot()` |
| `"ready"` | none | once, after the first snapshot |
| `"command"` | `PixelNetworkCommand` | a command from another client, after `canvas.applyRemoteCommand()` |
| `"notice"` | `PixelAssetNotice` | the room refused an edit (`rejected`) or the asset was deleted (`deleted`) |

`ready` is `true` once the first snapshot has been applied.

## Local edits

Local commands receive an incrementing `seq`, the room's `clientId`, and a timestamp. Undo and redo use the original edit timestamp. Commands echoed from the local `clientId` are ignored.

## `destroy()`

Restores the previous `canvas.onBufferUpdated` listener and removes the room listener. It does not call `room.leave()`.

## PixelCollaboration

Builds a `PixelSyncClient` and every presence helper for one canvas:

```ts
new PixelCollaboration(options: {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
  label?: PeerLabel;
  color?: PeerColor;
  onRemoteUvDragging?: (payload: UVGhostPayload) => void;
})

type PeerLabel = (clientId: string, profile: PeerMetadata) => string | undefined;
type PeerColor = (clientId: string, profile: PeerMetadata) => string;
```

- `sync` is the `PixelSyncClient`, and `ready` mirrors `sync.ready`.
- `label` and `color` apply to cursors, and `color` to selection and UV ghosts. They default to `profile.username` and a color keyed on `clientId`.
- `onRemoteUvDragging` forwards to `UVGhostSync`'s option of the same name (see [PresenceSync](./PresenceSync.md#uvghostsync)).
- `destroy()` destroys every helper. It does not leave the room.
