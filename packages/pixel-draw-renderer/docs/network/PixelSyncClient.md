# PixelSyncClient

Client-side sync controller. Extends `@jolly-pixel/network`'s [`SyncAdapter`](../../../network/docs/sync/SyncAdapter.md).

It connects one `PixelArtCanvas` to one `@jolly-pixel/network` `Room`.

## Wire Format

```ts
type PixelNetworkCommand = PixelBufferHookEvent & network.NetworkCommandHeader;

interface PixelBufferSnapshot {
	size: Vec2;
	pixels: string; // base64 RGBA
	uvRegions: UVRegion[];
}

type PixelServerMessage = network.NetworkServerMessage<PixelNetworkCommand, PixelBufferSnapshot>;
```

`PixelNetworkCommand` actions come from `PixelBufferHookEvent` (`stroke`, `resized`, `texture-replaced`, `global-fill`, `select-edit`, and `uv-region-*`).

## Types Used By PixelSyncClient

```ts
new PixelSyncClient(options: PixelSyncClientOptions)

interface PixelSyncClientOptions {
	room: network.Room<PixelNetworkCommand, PixelServerMessage>;
}
```

`PixelSyncClient` stamps local buffer events with `clientId`/`seq`/`timestamp` before sending.

## Getting a Room

Use `network.Client.room()` from `@jolly-pixel/network` directly — no adapter required.

```ts
import * as network from "@jolly-pixel/network";
import type {
	PixelNetworkCommand,
	PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const networkClient = new network.Client({ url: `${wsProtocol}//${location.host}/ws-sync` });
const room = networkClient.room<PixelNetworkCommand, PixelServerMessage>(
	"pixel-draw:main"
);
room.join();
```

## Use It Like This

```ts
import {
  PixelSyncClient
} from "@jolly-pixel/pixel-draw.renderer";

const syncClient = new PixelSyncClient({ room });
syncClient.attach(canvas);

// Later
syncClient.destroy();
```

## What It Does

1. Watches local canvas edits and sends them.
2. Applies server snapshot on connect.
3. Applies remote commands from peers.
4. Ignores your own echoed commands.

## Properties

### `ready`

```ts
readonly ready: boolean
```

Whether the initial server snapshot has been applied. `false` until the `"ready"` event fires.

## Events

### `"ready"`

Fired once, the moment the first `"snapshot"` message is applied. Check `syncClient.ready` for the current state instead of relying on the event if the snapshot may have already landed by the time you attach the listener.

```ts
syncClient.on("ready", () => {
  console.log("initial snapshot applied");
});
```

## Lifecycle

### `attach(canvas)`

- Attaches exactly one canvas.
- Throws if you call `attach` twice without `detach`.
- Chains onto the current `canvas.onBufferUpdated` handler instead of replacing it.

### `detach()`

- Stops sync for the attached canvas.
- Restores the previous `onBufferUpdated` handler.
- Safe to call when nothing is attached.

### `destroy()`

- Calls `detach()`.
- Removes its own `"message"` listener from the room.
- Use this when the view/tab/session is done. `PixelCursorSync` may still hold its own listeners on the same room — this does not call `room.leave()`.

## Common Mistakes

1. Reusing one `PixelSyncClient` for multiple canvases.
2. Forgetting `destroy()` when unmounting UI.
3. Attaching before the room points to the right room name.
