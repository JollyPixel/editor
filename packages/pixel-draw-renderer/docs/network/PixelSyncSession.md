# PixelSyncSession

Client-side sync controller. Extends `EventTarget`.

It connects one `PixelArtCanvas` to one transport room.

## Transport Shape

Use a room-scoped transport with this shape:

```ts
interface PixelTransport {
	readonly clientId: string;
	send(command: PixelNetworkCommand): void;
	onMessage: ((message: PixelServerMessage) => void) | null;
	onPeerJoined: ((peerId: string) => void) | null;
	onPeerLeft: ((peerId: string) => void) | null;
}

interface PixelNetworkCommandHeader {
	clientId: string;
	seq: number;
	timestamp: number;
}

type PixelNetworkCommand = PixelBufferHookEvent & PixelNetworkCommandHeader;

interface PixelBufferSnapshot {
	size: Vec2;
	pixels: string; // base64 RGBA
	uvRegions: UVRegion[];
}

type PixelServerMessage =
	| { type: "snapshot"; data: PixelBufferSnapshot; }
	| { type: "command"; data: PixelNetworkCommand; };
```

`PixelNetworkCommand` actions come from `PixelBufferHookEvent` (`stroke`, `resized`, `texture-replaced`, `global-fill`, `select-edit`, and `uv-region-*`).

## Types Used By Session

```ts
new PixelSyncSession(options: PixelSyncSessionOptions)

interface PixelSyncSessionOptions {
	transport: PixelTransport;
}

interface PixelNetworkCommandHeader {
	clientId: string;
	seq: number;
	timestamp: number;
}
```

`PixelSyncSession` stamps local buffer events with these header fields before sending.

## Recommended Transport

Use `network.Client.room()` from `@jolly-pixel/network` directly.

```ts
import * as network from "@jolly-pixel/network";
import type {
	PixelNetworkCommand,
	PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const client = new network.Client({ url: `${wsProtocol}//${location.host}/ws-sync` });
const transport = client.room<PixelNetworkCommand, PixelServerMessage>(
	"pixel-draw:main"
);
```

No adapter required.

## Use It Like This

```ts
import {
  PixelSyncSession
} from "@jolly-pixel/pixel-draw.renderer";

const session = new PixelSyncSession({ transport });
session.attach(canvas);

// Later
session.destroy();
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

Dispatched once, the moment the first `"snapshot"` message is applied. Check `session.ready` for the current state instead of relying on the event if the snapshot may have already landed by the time you attach the listener.

```ts
session.addEventListener("ready", () => {
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
- Clears `transport.onMessage`.
- Use this when the view/tab/session is done.

## Common Mistakes

1. Reusing one session for multiple canvases.
2. Forgetting `destroy()` when unmounting UI.
3. Attaching before transport points to the right room.
