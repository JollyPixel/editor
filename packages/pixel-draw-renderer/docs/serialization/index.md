# Serialization

`@jolly-pixel/pixel-draw.renderer` exports the `.pixelart` file format
from its root entrypoint. Nothing here touches the network or the asset
server, so a browser can read and write a file without pulling either in.

```ts
import {
  decodePixelArtFile,
  deserializePixelDocument,
  encodePixelArtFile,
  serializePixelDocument
} from "@jolly-pixel/pixel-draw.renderer";
```

## The `.pixelart` file

```ts
interface PixelArtFile {
  readonly version: 1;
  readonly size: Vec2;
  /** Base64 RGBA, row-major, 4 bytes per pixel. */
  readonly pixels: string;
  readonly uvRegions: UVRegionData[];
  readonly normalMap?: NormalMapData;
  readonly palette?: RGBA8[];
}
```

`normalMap` holds the [normal map settings](../normal/NormalMapConfig.md). A file without it loads with the feature off, so `version` stays `1`. `PixelDocumentState.normalMap` carries it through `serializePixelDocument`, `deserializePixelDocument` and `pixelArtSnapshot`.

`palette` holds exactly ten [RGBA8 colors](../ColorPalette.md), including
alpha. New files and snapshots include it. Older version `1` files
without it load the default palette. Invalid lengths or channel values are
rejected. Palette data travels through `serializePixelDocument`,
`deserializePixelDocument` and `pixelArtSnapshot`.

Deliberately not a PNG. The file carries UV regions, which an image
format cannot, and encoding one needs no image codec on the server, where
`canvas.toBlob` does not exist.

`PixelBufferSnapshot` is the same shape without `version`, and it is declared
here rather than in `network/`: the file format owns it, and the wire
protocol re-exports it. That is what makes the file and the wire agree by
construction instead of by convention.

## API

| Function | Purpose |
|---|---|
| `createPixelArtFile(size, pixels?)` | size + RGBA8 bytes → `PixelArtFile`; `pixels` defaults to transparent |
| `serializePixelDocument(state)` | [`PixelDocumentState`](../PixelDocumentState.md) → `PixelArtFile` |
| `deserializePixelDocument(file, state)` | `PixelArtFile` → `PixelDocumentState` of a `PixelBuffer` |
| `pixelArtSnapshot(state)` | `PixelDocumentState` → `PixelBufferSnapshot`, for the wire |
| `encodePixelArtFile(file)` | file → UTF-8 JSON bytes |
| `decodePixelArtFile(bytes)` | JSON bytes → validated file |
| `parsePixelArtFile(value)` | already-parsed JSON → validated file |
| `encodePixelBytes(pixels)` | RGBA8 bytes → base64, encoding the view only |
| `decodePixelBytes(pixels)` | base64 → `Uint8ClampedArray` |
| `encodePngPixels(pixels, size)` | RGBA8 bytes → `PngPixels`, a base64 PNG |
| `decodePngPixels(pixels, size)` | `PngPixels` → `Uint8ClampedArray` |

`decodePixelArtFile` validates rather than asserts, because a file
reaches it from persistence: an unsupported version, a size that is not a pair of positive integers,
invalid `normalMap` settings, or pixels shorter than the declared size all throw
`InvalidPixelArtFileError`. `deserializePixelDocument` throws the same error
for a size the target buffer would refuse. `createPixelArtFile` throws it
for a non-positive size or a `pixels` length other than `x * y * 4`.

A loaded file is complete state, not a patch. UV regions are cleared
before the file's are applied.

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
RGBA8 and about 95 KB as a base64 PNG. `encodePngPixels` skips PNG row
filtering, which suits pixel art: it is faster and smaller than adaptive
filtering. Both are asynchronous. `encodePngPixels` reads
the first `size.x * size.y * 4` bytes before its first `await`, so the buffer
can change while it compresses. `decodePngPixels` throws
`InvalidPixelArtFileError` when the image is not `size`. Persisted
files keep base64 RGBA8.

## Seeding a file from an image

```ts
import {
  createPixelBufferFromPng,
  encodePixelArtFile,
  PixelDocumentState,
  serializePixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

const buffer = await createPixelBufferFromPng(
  await fs.readFile("textures/tileset.png")
);
const file = encodePixelArtFile(
  serializePixelDocument(new PixelDocumentState({ buffer }))
);
```

The buffer is sized to the image and holds its exact samples, decoded by
[`decodePng`](https://github.com/JollyPixel/editor/blob/main/packages/image/docs/png.md). UV regions stay empty, since PNG cannot carry
them. `maxSize` defaults to the image's own dimensions when they exceed
`PixelBuffer`'s 2048 ceiling, so an oversized atlas still fits; pass it
explicitly to pin a different bound.
