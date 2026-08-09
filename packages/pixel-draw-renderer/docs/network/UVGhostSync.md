# UVGhostSync

Broadcasts the local in-progress UV region drag and renders remote peers' drags on `PixelArtCanvas.peerUvGhosts` as a dashed, per-peer-colored border.

Purely ephemeral: never touches `UVMap` state or history. A peer's ghost is cleared the moment any authoritative command from them arrives (or the whole document is replaced by a snapshot), or after ~1.5s of inactivity.

The sync layer owns the per-client inactivity lease. Rendering overlays only store and draw the state they receive.

No server extension needed: presence is relayed by `network.Room` itself (`updatePresence`/`onPeerPresence`), independent of `PixelSyncServer`. Reuse the same room a `PixelSyncClient` already has open — one connection, one more concern.

Unlike `PixelStrokeGhostSync`, this taps `PixelArtCanvas.uv`'s `"region-dragging"` event directly — `UVMap` already emits it on every drag tick (`UVController` calls `uvMap.previewMove()` on each pointer move), so no extra hook needs to be wired into any tool controller.

## Types Used By UVGhostSync

```ts
new UVGhostSync(options: UVGhostSyncOptions)

interface UVGhostSyncOptions {
	room: network.Room<PixelNetworkCommand, PixelServerMessage>;
	enableGhostPreview?: boolean; // default true
}
```

`network.Client.room()` from `@jolly-pixel/network` is the very same object `PixelSyncClient` uses for buffer sync — pass it to both.

## Use It Like This

```ts
import {
  PixelSyncClient,
  UVGhostSync
} from "@jolly-pixel/pixel-draw.renderer";

const room = networkClient.room<PixelNetworkCommand, PixelServerMessage>("pixel-draw:main");
room.join();

const syncClient = new PixelSyncClient({ room });
syncClient.attach(canvas);

const uvGhostSync = new UVGhostSync({ room });
uvGhostSync.attach(canvas);

// Later
uvGhostSync.destroy();
```

Set `enableGhostPreview: false` to disable the feature entirely — a no-op `attach()` that never wires the `"region-dragging"` listener or touches `canvas.peerUvGhosts`, for bandwidth-constrained sessions:

```ts
new UVGhostSync({ room, enableGhostPreview: false });
```

## What It Does

1. Watches `canvas.uv`'s `"region-dragging"` event and, at most once per animation frame, sends the current drag's `{id, face, geometry}` via `room.updatePresence({ uvGhost: payload })` — a full snapshot each tick, not a delta.
2. On `"peer-presence"`, mirrors a peer's drag onto `canvas.peerUvGhosts`, painting a dashed border colored by a hash of their `clientId`.
3. On `"peer-left"`, removes that peer's ghost.
4. On an incoming authoritative `"command"` from a peer, removes their ghost immediately.
5. On an incoming `"snapshot"`, clears every peer's ghost.
6. Registers its own `"peer-left"`/`"peer-presence"`/`"message"` listeners via `room.on` — since `Room` supports multiple listeners per event, this never clobbers `PixelStrokeGhostSync`/`PixelCursorSync`/`PixelSyncClient` listening on the same room.

## Lifecycle

### `attach(canvas)`

- Attaches exactly one canvas.
- Throws if you call `attach` twice without `detach`.

### `detach()`

- Stops local drag broadcasts and cancels any pending animation-frame-scheduled send.
- Clears remote peer ghosts and cancels their pending inactivity leases.

### `destroy()`

- Calls `detach()`.
- Removes its own `"peer-left"`/`"peer-presence"`/`"message"` listeners via `room.off`; other listeners on the room are untouched.

## Common Mistakes

1. Building a second `network.Client`/room for UV ghost streaming instead of reusing the sync one.
2. Expecting a canceled drag (pointer released without net movement) to clear a peer's ghost instantly — it never commits, so it sits until the ~1.5s TTL expires (same pre-existing behavior as brush/select ghosts).
