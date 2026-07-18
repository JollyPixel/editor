# network/types

Wire-format types for the [network sync layer](./index.md).

## Types

```ts
/**
 * Buffer create/destroy events. A CanvasManager has no concept of a bufferId
 * so these are never emitted from a CanvasManager's onBufferUpdated hook —
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
  }
  | {
    action: "buffer-removed";
    metadata: Record<string, never>;
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
}
```

`PixelBufferHookEvent` (the `"stroke"` / `"resized"` / `"texture-replaced"` / `"global-fill"` local-mutation events) is defined in [buffer/PixelBuffer.md](../buffer/PixelBuffer.md); a `PixelNetworkCommand` is that same event shape plus `PixelLifecycleEvent`, enriched with the header fields. Six actions total: `"buffer-added"`, `"buffer-removed"`, `"stroke"`, `"resized"`, `"texture-replaced"`, `"global-fill"`. All pixel payloads (`stroke` positions and `global-fill`'s colors excepted) are raw RGBA bytes, base64-encoded via `js-base64`: no image codec dependency, so `PixelSyncServer` stays headless. Commands are plain JSON-serializable objects.
