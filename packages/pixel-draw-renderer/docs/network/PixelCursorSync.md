# PixelCursorSync

Broadcasts the local cursor position and renders remote peers' cursors on `PixelArtCanvas.peerCursors`.

No server authority needed: presence is relayed by `network.Room` itself (`updatePresence`/`onPeerPresence`), independent of `PixelSyncServer`. Reuse the same room a `PixelSyncClient` already has open — one connection, two concerns.

## Types Used By PixelCursorSync

```ts
new PixelCursorSync(options: PixelCursorSyncOptions)

interface PixelCursorSyncOptions {
	room: network.Room<PixelNetworkCommand, PixelServerMessage>;
	getLabel?: (identity: network.PeerMetadata) => string | undefined;
}
```

`network.Client.room()` from `@jolly-pixel/network` is the very same object `PixelSyncClient` uses for buffer sync — pass it to both.

## Use It Like This

```ts
import {
  PixelSyncClient,
  PixelCursorSync
} from "@jolly-pixel/pixel-draw.renderer";

const room = networkClient.room<PixelNetworkCommand, PixelServerMessage>("pixel-draw:main");
room.join();

const syncClient = new PixelSyncClient({ room });
syncClient.attach(canvas);

const cursorSync = new PixelCursorSync({ room });
cursorSync.attach(canvas);

// Later
cursorSync.destroy();
```

Pass an `identity: { username: "..." }` on `new network.Client({ url, identity })` to give each peer a display label — `PixelCursorSync` reads `identity.username` by default. Override with `getLabel` for a different identity shape:

```ts
new PixelCursorSync({
  room,
  getLabel: (identity) => identity.displayName as string | undefined
});
```

## What It Does

1. Watches `canvas.onCursorMove` and calls `room.updatePresence({ cursor: pos })`, deduped against the last position sent.
2. On `"peer-presence"`/`"peer-joined"`, mirrors the peer's cursor onto `canvas.peerCursors` with a color hashed from their client id.
3. On `"peer-left"`, removes that peer's marker.
4. Registers its own `"peer-joined"`/`"peer-left"`/`"peer-presence"` listeners via `room.addEventListener` — since `Room` supports multiple listeners per event, this never clobbers other code (e.g. your own connect/disconnect logging) listening on the same room.

## Lifecycle

### `attach(canvas)`

- Attaches exactly one canvas.
- Throws if you call `attach` twice without `detach`.
- Seeds cursors for peers already on the room that have already reported a position.

### `detach()`

- Stops local cursor broadcasts.
- Leaves remote peer markers in place; call `destroy()` to also stop reacting to them.

### `destroy()`

- Calls `detach()`.
- Removes its own `"peer-joined"`/`"peer-left"`/`"peer-presence"` listeners via `room.removeEventListener` — other listeners on the room are untouched.

## Known Limitation

A peer who joined (and hasn't moved since) before you attach won't show a cursor until they move — `"sync"` populates `room.peers` directly without firing `"peer-joined"`, so there's nothing to seed from until their next presence update.

## Common Mistakes

1. Building a second `network.Client`/room for cursors instead of reusing the sync one.
