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

The `size` dimensions and `maxSize` must be positive integers. Neither size dimension may exceed `maxSize`. Invalid values throw `RangeError`.

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

### `drawRegion(rect, pixels)`

```ts
drawRegion(rect: SelectionRect, pixels: RGBA[]): void
```

Writes a rectangular block of row-major colors. The array contains `rect.width * rect.height` entries. Out-of-bounds positions are skipped.

### `drawMaskedRegion(rect, pixels, mask)`

```ts
drawMaskedRegion(rect: SelectionRect, pixels: RGBA[], mask: boolean[]): void
```

Same as `drawRegion`, but skips cells where `mask[i]` is `false`. Used for non-rectangular (shape-selected) regions.

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

### `hasTransparency(rect)`

```ts
hasTransparency(rect: SelectionRect): boolean
```

Returns `true` when `rect` contains an alpha value below `255` or extends outside the buffer. It scans the rectangle on every call.

## UV regions

```ts
readonly uvRegions: UVRegionCollection
```

Id-keyed [`UVRegion`](../uv/UVRegion.md) storage included in [`PixelSyncServer.snapshot()`](../network/api/PixelSyncServer.md#snapshot). `set()` accepts a `UVRegion` or raw `UVRegionData`, and the collection is iterable.

```ts
uvRegions.get(id: string): UVRegion | undefined
uvRegions.set(region: UVRegion | UVRegionData): void
uvRegions.remove(id: string): void
```

