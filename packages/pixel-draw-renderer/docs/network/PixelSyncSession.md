# PixelSyncSession

Client-side network orchestrator. A single `PixelSyncSession` multiplexes many buffers (textures/tilesets) over one [`PixelTransport`](./PixelTransport.md) connection. Each attached `PixelArtCanvas` still owns exactly one texture; the session just assigns it a `bufferId` for routing:

- Local mutations from an attached `PixelArtCanvas` are stamped and forwarded.
- Remote commands are routed to the matching `PixelArtCanvas` by `bufferId`.
- Buffer lifecycle (add/remove) is announced/received at the session level.

One `PixelSyncSession` per transport connection. Each `PixelArtCanvas` is attached under exactly one `bufferId`.

## Types

```ts
new PixelSyncSession(options: PixelSyncSessionOptions)

interface PixelSyncSessionOptions {
  transport: PixelTransport;
}
```

## Properties

### `onBufferAdded` / `onBufferRemoved`

```ts
onBufferAdded: ((bufferId: string, metadata: { size: Vec2; pixels?: string; }) => void) | null
onBufferRemoved: ((bufferId: string) => void) | null
```

Called when a **peer** creates or removes a buffer this session hasn't (yet) attached to itself.

## Methods

### `attach`

```ts
attach(bufferId: string, canvasManager: PixelArtCanvas): void
```

Attaches an existing `PixelArtCanvas` to sync as `bufferId`. Assumes the buffer already exists on the server; subscribes and awaits its snapshot via `transport.onSnapshot`. Throws if `bufferId` is already attached.

---

### `createBuffer`

```ts
createBuffer(bufferId: string, canvasManager: PixelArtCanvas, options: { size: Vec2; pixels?: string; }): void
```

Attaches a `PixelArtCanvas` **and** announces a brand new buffer to peers, carrying the manager's current pixel data as the initial shared state.

---

### `detach` / `removeBuffer`

```ts
detach(bufferId: string): void
removeBuffer(bufferId: string): void
```

`detach` stops syncing a texture without announcing anything to peers (e.g. the user closed that tab). `removeBuffer` does the same, and also tells peers the buffer is gone.

---

### `destroy`

```ts
destroy(): void
```

Detaches every buffer and clears the transport's `onCommand`/`onSnapshot` callbacks. Call when the session ends.

## Example

```ts
import { fromUint8Array } from "js-base64";
import { PixelSyncSession } from "@jolly-pixel/pixel-draw.renderer";

const session = new PixelSyncSession({ transport: myTransport });

// Attach an existing texture, assumed to already exist on the server.
// Subscribes and receives its snapshot asynchronously via onSnapshot.
session.attach("tileset-1", canvasManager);

// Attach AND announce a brand new buffer, seeding peers with its current pixels.
session.createBuffer("tileset-2", otherPixelArtCanvas, {
  size: otherPixelArtCanvas.textureSize,
  pixels: fromUint8Array(new Uint8Array(otherPixelArtCanvas.texture))
});

session.onBufferAdded = (bufferId, metadata) => {
  // A peer created a new buffer this client hasn't attached to.
};
session.onBufferRemoved = (bufferId) => {
  // A peer removed a buffer.
};

// Stop syncing a texture (e.g. the user closed that tab).
session.detach("tileset-1");
// Same, but also tells peers the buffer is gone.
session.removeBuffer("tileset-2");

session.destroy();
```
