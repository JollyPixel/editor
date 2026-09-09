# Serialization

`@jolly-pixel/pixel-draw.renderer` exports the `.pixelart` document format
from its root entrypoint. Nothing here touches the network or the asset
server, so a browser can read and write a document without pulling either in.

```ts
import {
  decodePixelArtDocument,
  deserializePixelBuffer,
  encodePixelArtDocument,
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";
```

## The `.pixelart` document

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
`canvas.toBlob` does not exist.

`PixelBufferSnapshot` is the same shape without `version`, and it is declared
here rather than in `network/`: the file format owns it, and the wire
protocol re-exports it. That is what makes the file and the wire agree by
construction instead of by convention.

## API

| Function | Purpose |
|---|---|
| `serializePixelBuffer(buffer)` | `PixelBuffer` → `PixelArtDocumentData` |
| `deserializePixelBuffer(document, buffer)` | `PixelArtDocumentData` → `PixelBuffer` |
| `pixelArtSnapshot(buffer)` | `PixelBuffer` → `PixelBufferSnapshot`, for the wire |
| `encodePixelArtDocument(document)` | document → UTF-8 JSON bytes |
| `decodePixelArtDocument(bytes)` | JSON bytes → validated document |
| `parsePixelArtDocument(value)` | already-parsed JSON → validated document |

`decodePixelArtDocument` validates rather than asserts, because a document
reaches it from persistence: an unsupported version, a non-integer size, or
pixels shorter than the declared size all throw
`InvalidPixelArtDocumentError`. `deserializePixelBuffer` throws the same error
for a size the target buffer would refuse.

A loaded document is complete state, not a patch. UV regions are cleared
before the document's are applied.

## Seeding a document from an image

```ts
import {
  createPixelBufferFromPng,
  encodePixelArtDocument,
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";

const buffer = await createPixelBufferFromPng(
  await fs.readFile("textures/tileset.png")
);
const document = encodePixelArtDocument(
  serializePixelBuffer(buffer)
);
```

The buffer is sized to the image and holds its exact samples, decoded by
[`decodePng`](https://github.com/JollyPixel/editor/blob/main/packages/image/docs/png.md). UV regions stay empty, since PNG cannot carry
them. `maxSize` defaults to the image's own dimensions when they exceed
`PixelBuffer`'s 2048 ceiling, so an oversized atlas still fits; pass it
explicitly to pin a different bound.
