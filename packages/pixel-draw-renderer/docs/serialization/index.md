# Serialization

`@jolly-pixel/pixel-draw.renderer` exports the `.pixelart` document format
from its root entrypoint. Nothing here touches the network or the asset
server, so a browser can read and write a document without pulling either in.

```ts
import {
  decodePixelArtDocument,
  deserializePixelDocument,
  encodePixelArtDocument,
  serializePixelDocument
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
  readonly normalMap?: NormalMapData;
  readonly palette?: RGBA8[];
}
```

`normalMap` holds the [normal map settings](../normal/NormalMapConfig.md). A document without it loads with the feature off, so `version` stays `1`. `PixelDocumentState.normalMap` carries it through `serializePixelDocument`, `deserializePixelDocument` and `pixelArtSnapshot`.

`palette` holds exactly ten [RGBA8 colors](../ColorPalette.md), including
alpha. New documents and snapshots include it. Older version `1` documents
without it load the default palette. Invalid lengths or channel values are
rejected. Palette data travels through `serializePixelDocument`,
`deserializePixelDocument` and `pixelArtSnapshot`.

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
| `createPixelArtDocument(size, pixels?)` | size + RGBA8 bytes → `PixelArtDocumentData`; `pixels` defaults to transparent |
| `serializePixelDocument(state)` | [`PixelDocumentState`](../PixelDocumentState.md) → `PixelArtDocumentData` |
| `deserializePixelDocument(document, state)` | `PixelArtDocumentData` → `PixelDocumentState` of a `PixelBuffer` |
| `pixelArtSnapshot(state)` | `PixelDocumentState` → `PixelBufferSnapshot`, for the wire |
| `encodePixelArtDocument(document)` | document → UTF-8 JSON bytes |
| `decodePixelArtDocument(bytes)` | JSON bytes → validated document |
| `parsePixelArtDocument(value)` | already-parsed JSON → validated document |
| `encodePixelBytes(pixels)` | RGBA8 bytes → base64, encoding the view only |
| `decodePixelBytes(pixels)` | base64 → `Uint8ClampedArray` |
| `encodePngPixels(pixels, size)` | RGBA8 bytes → `PngPixels`, a base64 PNG |
| `decodePngPixels(pixels, size)` | `PngPixels` → `Uint8ClampedArray` |

`decodePixelArtDocument` validates rather than asserts, because a document
reaches it from persistence: an unsupported version, a size that is not a pair of positive integers,
invalid `normalMap` settings, or pixels shorter than the declared size all throw
`InvalidPixelArtDocumentError`. `deserializePixelDocument` throws the same error
for a size the target buffer would refuse. `createPixelArtDocument` throws it
for a non-positive size or a `pixels` length other than `x * y * 4`.

A loaded document is complete state, not a patch. UV regions are cleared
before the document's are applied.

`encodePixelBytes` and `decodePixelBytes` are the base64 codec the other
functions use for the `pixels` field. They are exported so a consumer that
reads or writes that field on its own, such as a wire snapshot or a
`texture-replaced` command, does not have to pick its own base64 library and
stay in step with this one.

```ts
interface PngPixels {
  readonly format: "png";
  readonly data: string;
}
```

`encodePngPixels` and `decodePngPixels` are the compact alternative for a
snapshot sent over the network: a 1024x512 tileset is about 2.7 MB as base64
RGBA8 and about 165 KB as a base64 PNG. Both are asynchronous. `encodePngPixels` reads
the first `size.x * size.y * 4` bytes before its first `await`, so the buffer
can change while it compresses. `decodePngPixels` throws
`InvalidPixelArtDocumentError` when the image is not `size`. Persisted
documents keep base64 RGBA8.

## Seeding a document from an image

```ts
import {
  createPixelBufferFromPng,
  encodePixelArtDocument,
  PixelDocumentState,
  serializePixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

const buffer = await createPixelBufferFromPng(
  await fs.readFile("textures/tileset.png")
);
const document = encodePixelArtDocument(
  serializePixelDocument(new PixelDocumentState({ buffer }))
);
```

The buffer is sized to the image and holds its exact samples, decoded by
[`decodePng`](https://github.com/JollyPixel/editor/blob/main/packages/image/docs/png.md). UV regions stay empty, since PNG cannot carry
them. `maxSize` defaults to the image's own dimensions when they exceed
`PixelBuffer`'s 2048 ceiling, so an oversized atlas still fits; pass it
explicitly to pin a different bound.
