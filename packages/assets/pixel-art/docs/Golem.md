# Golem

`@jolly-pixel/asset.pixel-art/golem` lets a golem open `pixelart` assets. Its `GOLEM_KINDS` export is what `@jolly-pixel/golem` imports for the kind when the studio lists this package; `golem.open(assetId, "pixelart")` then returns the class below. Importing the entry adds the kind to the `GolemAssets` interface of `@jolly-pixel/golem.kit`, which types that call.

An agent reaches the same edits through the MCP server: `asset_open` answers the guide in `src/golem/guide.md` and the intents below with their input schema, and `asset_intent` runs one.

## Intents

`pixelIntents()` builds them, and a blockset reuses them for its texture:

- `readPixels`, `paintPixels`, `fillRect` and `replacePalette`: each runs the `PixelSurface` method of the same name with its input and answers what the method returns.

## `PixelArtAsset`

The asset for `pixelart`, a texture people paint in the pixel-art editor. Commands are its document commands as JSON carries them (`stroke` with `positions`, `palette-replaced`, UV region and normal map commands); `texture-replaced`, which carries raw bytes, is left out. Colors are what `Color.from` from `@jolly-pixel/color` parses, such as `"#rrggbb"`, `"#rrggbbaa"` or `"red"`, and a malformed one throws `ColorParseError`.

```ts
const texture = await golem.open(assetId, "pixelart");
await texture.pixels.fillRect({ x: 0, y: 0, width: 16, height: 4, color: "#3a7d2c" });
await texture.pixels.paintPixels({ pixels: [{ x: 3, y: 1, color: "#ffffff80" }] });
await texture.settled();
```

### `pixels: PixelSurface`

The texture's pixels ([`PixelSurface`](#pixelsurface)).

### `read(): PixelArtSummary`

`pixels.summary()`.

### Focus

After each batch with a stroke, the golem's cursor (`cursor`) moves to the last painted pixel, as the pixel-art editor shows a person's cursor. A blockset publishes the same cursor.

## `PixelSurface`

The pixels of a `PixelArtAsset` or a `BlocksetAsset` texture. Its writes go through the asset's `apply`, so `settled()` on the asset waits for them. Colors are what `Color.from` from `@jolly-pixel/color` parses, such as `"#rrggbb"`, `"#rrggbbaa"` or `"red"`, and a malformed one throws `ColorParseError`. A position or rect that is not whole pixels inside the texture throws `RangeError` before anything is sent.

### `size: Vec2` and `maxSize: number`

The texture's size, and the largest side `resize` accepts.

### `summary(): PixelArtSummary`

The size, the palette as `"#rrggbbaa"` strings and the UV regions as `{ id, name, bounds }`, without the pixels.

### `readPixels(rect): PixelRead`

The colors of `rect` (`{ x, y, width, height }`), one row per y, as `"#rrggbbaa"`. Throws `RangeError` for more than `MAX_READ_PIXELS` (4,096) pixels.

### `paintPixels({ pixels }): Promise<number>`

Paints the `{ x, y, color }` entries of `pixels`, one `stroke` per color, and returns how many it painted.

### `fillRect({ x, y, width, height, color }): Promise<number>`

Paints every pixel of the rect with `color` and returns how many it painted. Strokes hold at most `MAX_STROKE_PIXELS` (16,384) pixels.

### `replacePalette({ colors }): Promise<void>`

Replaces the palette the editor offers. It repaints nothing.

### `resize(size): Promise<void>`

Resizes the texture to `size` (`{ x, y }`), keeping the pixels that fit from the top-left corner. Neither side may exceed `maxSize`.

## How it works

- A pixel-art texture uses the editor's own `SyncedPixelDocument`: `PixelDocument` creates its canvas only when asked, so it runs in Node. Its schema is `pixelEditCommandSchema`: every document variant of each command, without the packed wire variants and `texture-replaced`.
