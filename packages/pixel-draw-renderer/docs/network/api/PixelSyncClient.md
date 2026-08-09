# PixelSyncClient

Connects one `PixelArtCanvas` to one `@jolly-pixel/network` room. It extends the network package's [`SyncAdapter`](../../../../network/docs/sync/SyncAdapter.md).

## Constructor

```ts
new PixelSyncClient(options: PixelSyncClientOptions)

interface PixelSyncClientOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
}
```

The constructor starts listening for room messages. It does not join or leave the room.

## Types

```ts
type PixelNetworkCommand =
  PixelBufferHookEvent & NetworkCommandHeader;

interface PixelBufferSnapshot {
  size: Vec2;
  pixels: string;
  uvRegions: UVRegionData[];
}

type PixelServerMessage = NetworkServerMessage<
  PixelNetworkCommand,
  PixelBufferSnapshot
>;
```

`pixels` contains base64-encoded RGBA bytes. `PixelNetworkCommand` accepts the actions listed in [canvas integration](./CanvasIntegration.md#mutation-commands).

## Properties

### `ready`

```ts
get ready(): boolean
```

Returns whether the first snapshot message has been received. Attach the canvas before `room.join()` to ensure that snapshot is applied.

## Events

### `"ready"`

Fires once when the first snapshot message arrives.

```ts
sync.on("ready", listener);
sync.off("ready", listener);
```

### `"snapshot"`

Fires after every snapshot message. When a canvas is attached, its texture and UV regions have been replaced before the event fires.

```ts
sync.on("snapshot", listener);
sync.off("snapshot", listener);
```

## Methods

### `attach(canvas)`

```ts
attach(canvas: PixelArtCanvas): void
```

Attaches one canvas and chains the current `canvas.onBufferUpdated` listener. Throws when another canvas is already attached.

Local commands receive an incrementing `seq`, the room's `clientId`, and a timestamp. Undo and redo use the original edit timestamp.

### `detach()`

```ts
detach(): void
```

Stops synchronization and restores the listener captured by `attach()`. Calling it without an attached canvas has no effect.

### `destroy()`

```ts
destroy(): void
```

Calls `detach()` and removes the controller's `"message"` listener. It does not call `room.leave()`.

## Remote data

Snapshots call `canvas.loadSnapshot()`. Commands from another `clientId` call `canvas.applyRemoteCommand()`; commands echoed from the local `clientId` are ignored.
