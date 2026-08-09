# PixelStrokeGhostSync

Broadcasts the local in-progress stroke/drag pixels and renders remote peers' ghosts on `PixelArtCanvas.peerStrokeGhosts`.

Purely ephemeral: never touches `History` or the authoritative buffer. A peer's ghost is cleared the moment any authoritative command from them arrives (or the whole document is replaced by a snapshot), or after ~1.5s of inactivity.

The sync layer owns the per-client inactivity lease. Rendering overlays only store and draw the state they receive.

No server extension needed: presence is relayed by `network.Room` itself (`updatePresence`/`onPeerPresence`), independent of `PixelSyncServer`. Reuse the same room a `PixelSyncClient` already has open — one connection, two concerns.

## Types Used By PixelStrokeGhostSync

```ts
new PixelStrokeGhostSync(options: PixelStrokeGhostSyncOptions)

interface PixelStrokeGhostSyncOptions {
	room: network.Room<PixelNetworkCommand, PixelServerMessage>;
	enableGhostPreview?: boolean; // default true
}
```

`network.Client.room()` from `@jolly-pixel/network` is the very same object `PixelSyncClient` uses for buffer sync — pass it to both.

## Use It Like This

```ts
import {
  PixelSyncClient,
  PixelStrokeGhostSync
} from "@jolly-pixel/pixel-draw.renderer";

const room = networkClient.room<PixelNetworkCommand, PixelServerMessage>("pixel-draw:main");
room.join();

const syncClient = new PixelSyncClient({ room });
syncClient.attach(canvas);

const strokeGhostSync = new PixelStrokeGhostSync({ room });
strokeGhostSync.attach(canvas);

// Later
strokeGhostSync.destroy();
```

Set `enableGhostPreview: false` to disable the feature entirely — a no-op `attach()` that never wires the send hook or touches `canvas.peerStrokeGhosts`, for bandwidth-constrained sessions:

```ts
new PixelStrokeGhostSync({ room, enableGhostPreview: false });
```

## What It Does

1. Watches `canvas.onStrokeProgress` and, at most once per animation frame, sends the *entire* current in-progress pixel set via `room.updatePresence({ strokeGhost: pixels })` — a full snapshot each tick, not a delta, so a dropped or late message is simply superseded by the next one.
2. On `"peer-presence"`, mirrors a peer's pixels onto `canvas.peerStrokeGhosts`.
3. On `"peer-left"`, removes that peer's ghost.
4. On an incoming authoritative `"command"` from a peer, removes their ghost immediately — the real committed pixels have landed, so the ghost would otherwise double up or, after conflict resolution, visibly mismatch.
5. On an incoming `"snapshot"`, clears every peer's ghost — none of the in-progress state it described survives a full document replace.
6. Registers its own `"peer-left"`/`"peer-presence"`/`"message"` listeners via `room.on` — since `Room` supports multiple listeners per event, this never clobbers other code listening on the same room.

## Lifecycle

### `attach(canvas)`

- Attaches exactly one canvas.
- Throws if you call `attach` twice without `detach`.

### `detach()`

- Stops local stroke-progress broadcasts and cancels any pending animation-frame-scheduled send.
- Clears remote peer ghosts and cancels their pending inactivity leases.

### `destroy()`

- Calls `detach()`.
- Removes its own `"peer-left"`/`"peer-presence"`/`"message"` listeners via `room.off`; other listeners on the room are untouched.

## Common Mistakes

1. Building a second `network.Client`/room for ghost streaming instead of reusing the sync one.
2. Expecting a peer's ghost to disappear instantly on their side when they lift the pen — it clears once *your* client receives their commit, not before.
