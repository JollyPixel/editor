# network/types

Wire-format types for the [network sync layer](./index.md).

## Types

```ts
/**
 * Buffer create/destroy events. A PixelArtCanvas has no concept of a bufferId,
 * so these are never emitted from a PixelArtCanvas's onBufferUpdated hook;
 * they are constructed directly by PixelSyncSession.createBuffer/removeBuffer.
 */
type PixelLifecycleEvent =
  | {
    action: "buffer-added";
    metadata: {
      size: Vec2;
      /** Base64-encoded RGBA bytes for the buffer's initial content, if any. */
      pixels?: string;
    };
    originTimestamp?: number;
  }
  | {
    action: "buffer-removed";
    metadata: Record<string, never>;
    originTimestamp?: number;
  };

type PixelNetworkEvent = PixelBufferHookEvent | PixelLifecycleEvent;

interface PixelNetworkCommandHeader {
  bufferId: string;
  clientId: string;
  /** Monotonically increasing sequence number per client. */
  seq: number;
  /** Unix timestamp in milliseconds when the command was created. */
  timestamp: number;
}

/**
 * A network command is a buffer event enriched with routing metadata.
 * It can be sent over any transport (WebSocket, WebRTC, Partykit, etc.).
 */
type PixelNetworkCommand = PixelNetworkEvent & PixelNetworkCommandHeader;

interface PixelBufferSnapshot {
  size: Vec2;
  /** Base64-encoded RGBA bytes. */
  pixels: string;
  uvRegions: UVRegion[];
}
```

`PixelBufferHookEvent` (the `"stroke"` / `"resized"` / `"texture-replaced"` / `"global-fill"` / `"uv-region-created"` / `"uv-region-deleted"` / `"uv-region-moved"` local-mutation events) is defined in [buffer/PixelBuffer.md](../buffer/PixelBuffer.md); a `PixelNetworkCommand` is that same event shape plus `PixelLifecycleEvent`, enriched with the header fields. Nine actions total: `"buffer-added"`, `"buffer-removed"`, `"stroke"`, `"resized"`, `"texture-replaced"`, `"global-fill"`, `"uv-region-created"`, `"uv-region-deleted"`, `"uv-region-moved"`. All pixel payloads (`stroke` positions and `global-fill`'s colors excepted) are raw RGBA bytes, base64-encoded via `js-base64`: no image codec dependency, so `PixelSyncServer` stays headless. Commands are plain JSON-serializable objects. `PixelBufferSnapshot.uvRegions` carries the buffer's full current UV region set, so a client subscribing mid-session learns about every region that already exists (see [uv/UVMap.md](../uv/UVMap.md)).

> [!IMPORTANT]
> `PixelLifecycleEvent`'s `originTimestamp` exists only for structural symmetry with `PixelBufferHookEvent` (so the stamping logic in [`PixelSyncSession`](./PixelSyncSession.md) can handle every event uniformly). `"buffer-added"`/`"buffer-removed"` are never replayed through undo/redo, so it's always `undefined` in practice for these two actions.
