# PixelSyncSession

Client-side network orchestrator for a single buffer. A `PixelSyncSession` pairs one attached `PixelArtCanvas` with one [`PixelTransport`](./PixelTransport.md) connection, which is already scoped to that buffer's `PixelSyncServer` namespace:

- Local mutations from the attached `PixelArtCanvas` are stamped and forwarded.
- Remote commands are routed to the attached `PixelArtCanvas`.
- The buffer's snapshot is applied as soon as the transport receives it (pushed by the server on connect).

Syncing several buffers (e.g. multiple open tilesets) means one `PixelSyncSession`/transport pair per buffer, each joined to that buffer's own namespace.

## Types

```ts
new PixelSyncSession(options: PixelSyncSessionOptions)

interface PixelSyncSessionOptions {
  transport: PixelTransport;
}
```

## Methods

### `attach`

```ts
attach(canvasManager: PixelArtCanvas): void
```

Attaches a `PixelArtCanvas` to sync over the transport. Throws if a canvas is already attached.

Chains onto the canvas's existing `onBufferUpdated` handler (if any) instead of replacing it — a consumer's own local reaction keeps firing, followed by the forward-to-transport step. `detach()` restores that original handler.

---

### `detach`

```ts
detach(): void
```

Stops syncing the attached canvas without announcing anything to peers, restoring whatever `onBufferUpdated` handler was present before `attach()`. A no-op if nothing is attached.

---

### `destroy`

```ts
destroy(): void
```

Detaches the canvas and clears the transport's `onMessage` callback. Call when the session ends.

## Example

```ts
import { PixelSyncSession } from "@jolly-pixel/pixel-draw.renderer";

const session = new PixelSyncSession({ transport: myTransport });

// Attaches the canvas; the buffer's snapshot arrives asynchronously via
// transport.onMessage once the underlying connection is up.
session.attach(canvasManager);

// Stop syncing (e.g. the user closed this tab/panel).
session.detach();

session.destroy();
```
