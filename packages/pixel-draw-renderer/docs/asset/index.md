# Pixel-art asset kind

`@jolly-pixel/pixel-draw.renderer/asset/index.ts` supplies an
`AssetKindHandler` for `@jolly-pixel/asset-server`, so a pixel-art document
becomes a catalogued, event-sourced, persisted asset instead of a buffer held
in server memory.

```ts
import { pixelArtAssetHandler } from "@jolly-pixel/pixel-draw.renderer/asset/index.ts";

await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [pixelArtAssetHandler({ defaultSize: { x: 32, y: 32 } })]
});
```

`@jolly-pixel/asset-server` and `@jolly-pixel/event-store` are optional peer
dependencies of this package. Import the subpath only from server code.

## How it differs from PixelSyncServer

| | `PixelSyncServer` | `pixelArtAssetHandler` |
|---|---|---|
| Buffer lifetime | process memory | replayed from the event log |
| Persistence | none | snapshotted to the asset source |
| Room id | fixed, passed as `id` | `pixelart:${assetId}`, resolved on join |
| Who writes the buffer | the extension | `apply`, folding appended events |

The wire protocol is identical, so `PixelSyncClient` and every presence sync
work unchanged against either. Use `PixelSyncServer` for a single ephemeral
canvas; use the asset kind when the document is a file people expect to still
be there tomorrow.

Both share `PixelCommandArbiter`, which resolves conflicts without touching a
buffer. That separation is what lets the asset room append rather than mutate.

## The `.pixelart` document

The kind matches `**/*.pixelart` by default and stores JSON:

```ts
interface PixelArtDocumentData {
  readonly version: 1;
  readonly size: Vec2;
  /** Base64 RGBA, row-major, 4 bytes per pixel. */
  readonly pixels: string;
  readonly uvRegions: UVRegionData[];
}
```

Deliberately not a PNG. The document carries UV regions, which an image
format cannot, and encoding one needs no image codec on the server, where
`canvas.toBlob` does not exist. The payload matches `PixelBufferSnapshot`, so
the file and the wire agree.

`decodePixelArtDocument` validates rather than asserts, because a document
reaches it from persistence: an unsupported version, a non-integer size, or
pixels shorter than the declared size all throw
`InvalidPixelArtDocumentError`.

A loaded document is complete state, not a patch. UV regions are cleared
before the document's are applied.

## Why the room never writes

`apply` is the only writer. A room that mutated the buffer *and* appended
would apply every command twice, and live state would drift from a cold
replay. Pixel commands happen to be absolute writes that survive double
application, but relying on that would leave the kind one delta-carrying
command away from silent corruption.

## Errors

`apply` never throws. Its event is already persisted, so a fold that aborted
would break every later replay. A malformed document or command is logged and
skipped, leaving the last good buffer in place.

Commands the buffer could not apply are rejected by the arbiter before the
append, so a bad resize never reaches the log in the first place.
