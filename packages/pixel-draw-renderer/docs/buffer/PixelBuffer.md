# PixelBuffer

Headless RGBA pixel buffer with no DOM dependency. `PixelArtCanvas` uses an internal [`CanvasBuffer`](./CanvasBuffer.md) adapter to mirror it into an `HTMLCanvasElement`.

Maintains two arrays: a `working` buffer at the current size, and a retained `master` buffer that grows as larger dimensions are reached. `maxSize` is an upper bound rather than an up-front allocation. `copyToMaster()` commits working into master; `resize()` reads back from master, so shrinking and growing again doesn't lose content.

```ts
new PixelBuffer(options: PixelBufferOptions)

interface PixelBufferOptions {
  size: Vec2;
  /** @default { r: 255, g: 255, b: 255, a: 255 } */
  defaultColor?: RGBA | ColorInput;
  /** @default 2048 */
  maxSize?: number;
}
```

The `size` dimensions and `maxSize` must be positive integers. Neither size dimension may exceed `maxSize`. Invalid values throw `RangeError`. `acceptsSize(size)` answers the same check without throwing, and `assertSize(size)` throws as the constructor does.

The buffer is initialized with `defaultColor`.

## Methods

### `size()` / `resize(size)`

```ts
size(): Vec2
resize(size: Vec2): void
```

Returns the current working size. `resize()` restores committed content from master and grows retained storage when necessary. Newly reached pixels use the constructor's `defaultColor`. Dimensions above `maxSize` throw `RangeError`.

### `pixels()`

```ts
pixels(): Uint8ClampedArray
```

Returns the **live** working buffer (not a copy). Mutating it mutates the buffer directly.

### `replacePixels(pixels, size)`

```ts
replacePixels(pixels: Uint8ClampedArray, size: Vec2): void
```

Copies new pixel data into working and master storage, clears old master content, and changes the size. Missing bytes are transparent and extra bytes are ignored.

### `drawPixels(positions, color)`

```ts
drawPixels(positions: Iterable<Vec2>, color: RGBA): void
```

Stamps one color across multiple positions. Out-of-bounds positions are silently skipped.

### `drawColorGroups(groups)`

```ts
drawColorGroups(groups: Iterable<ColorGroup>): void
```

Stamps each group's color across its positions, as `drawPixels` does.

### `drawMaskedRegion(rect, pixels, mask)`

```ts
drawMaskedRegion(rect: SelectionRect, pixels: RGBA[], mask: boolean[]): void
```

Writes a rectangular block of row-major colors, skipping cells where `mask[i]` is `false`. The arrays contain `rect.width * rect.height` entries. Out-of-bounds positions are skipped.

### `copyToMaster()`

```ts
copyToMaster(): void
```

Commits the working buffer into master at `(0, 0)`.

### `samplePixel(x, y)`

```ts
samplePixel(x: number, y: number): [number, number, number, number]
```

Returns `[r, g, b, a]` at `(x, y)`. Out-of-bounds returns `[0, 0, 0, 0]`.

### `samplePixels(positions)`

```ts
samplePixels(positions: Vec2[]): RGBA[]
```

Batch `samplePixel`. Out-of-bounds positions return `{ r: 0, g: 0, b: 0, a: 0 }`.

### `positionsOf(color, mask?)`

```ts
positionsOf(color: RGBA, mask?: Uint8Array): Vec2[]
```

Returns every position holding exactly `color`, row by row. With a `mask`, positions whose mask entry is `0` are skipped. A `global-fill` command repaints these positions.

### `hasTransparency(rect)`

```ts
hasTransparency(rect: SelectionRect): boolean
```

Returns `true` when `rect` contains an alpha value below `255` or extends outside the buffer. It scans the rectangle on every call.

UV regions and normal map settings live beside the buffer in a [`PixelDocumentState`](../PixelDocumentState.md).

