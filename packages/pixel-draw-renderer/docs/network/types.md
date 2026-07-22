# network/types

Wire-format types for the [network sync layer](./index.md).

## Types

```ts
type PixelNetworkEvent = PixelBufferHookEvent;

interface PixelNetworkCommandHeader {
  clientId: string;
  /** Monotonically increasing sequence number per client. */
  seq: number;
  /** Unix timestamp in milliseconds when the command was created. */
  timestamp: number;
}

/**
 * A network command is a buffer event enriched with routing metadata.
 * It can be sent over any transport (WebSocket, WebRTC, Partykit, etc.).
 * Which buffer it targets is implied by the transport/namespace it travels
 * over, not carried in the command itself — see PixelSyncServer.md.
 */
type PixelNetworkCommand = PixelNetworkEvent & PixelNetworkCommandHeader;

interface PixelBufferSnapshot {
  size: Vec2;
  /** Base64-encoded RGBA bytes. */
  pixels: string;
  uvRegions: UVRegion[];
}
```

`PixelBufferHookEvent` (the `"stroke"` / `"resized"` / `"texture-replaced"` / `"global-fill"` / `"uv-region-created"` / `"uv-region-deleted"` / `"uv-region-moved"` local-mutation events) is defined in [buffer/PixelBuffer.md](../buffer/PixelBuffer.md); a `PixelNetworkCommand` is that same event shape enriched with the header fields. Eight actions total. All pixel payloads (`stroke` positions and `global-fill`'s colors excepted) are raw RGBA bytes, base64-encoded via `js-base64`: no image codec dependency, so `PixelSyncServer` stays headless. Commands are plain JSON-serializable objects. `PixelBufferSnapshot.uvRegions` carries the buffer's full current UV region set, so a client connecting mid-session learns about every region that already exists (see [uv/UVMap.md](../uv/UVMap.md)).
