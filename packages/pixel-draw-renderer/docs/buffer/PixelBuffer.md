# PixelBuffer

Headless RGBA pixel buffer (no DOM dependency).

Maintains two arrays: a `working` buffer at the current size, and a `master` buffer pre-allocated at `maxSize × maxSize`. `copyToMaster()` commits working into master; `resize()` reads back from master, so shrinking and growing again doesn't lose content.

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

Pixel `(0, 0)` is always initialized fully transparent.

## Methods

### `size()` / `resize(size)`

```ts
size(): Vec2
resize(size: Vec2): void
```

Returns the current working size, or resizes it (content restored from master, clipped to `maxSize`).

### `pixels()`

```ts
pixels(): Uint8ClampedArray
```

Returns the **live** working buffer (not a copy). Mutating it mutates the buffer directly.

### `replacePixels(pixels, size)`

```ts
replacePixels(pixels: Uint8ClampedArray, size: Vec2): void
```

Replaces pixel data wholesale and resizes to match. Used for network snapshots and image decoding.

### `drawPixels(positions, color)`

```ts
drawPixels(positions: Iterable<Vec2>, color: RGBA): void
```

Stamps one color across multiple positions. Out-of-bounds positions are silently skipped.

### `drawRegion(rect, pixels)`

```ts
drawRegion(rect: SelectionRect, pixels: RGBA[]): void
```

Writes a rectangular block of per-pixel colors (row-major, `rect.width * rect.height` entries). Out-of-bounds positions skipped.

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

`true` if any pixel in `rect` isn't fully opaque (`a < 255`), including antialiased/semi-transparent pixels, not just fully-transparent ones. A `rect` extending outside the buffer counts as transparent, same as `samplePixel(s)`'s out-of-bounds convention. Uncached — rescans `rect` on every call.

Also on `CanvasBuffer`, which delegates to this implementation.

### UV Regions

```ts
readonly uvRegions: UVRegionCollection
```

Server-side UV region storage for this buffer. Included in [`PixelSyncServer.snapshot()`](../network/PixelSyncServer.md#snapshot) so late-joining clients receive existing regions.

`UVRegionCollection` is an id-keyed map of [`UVRegion`](../uv/UVRegion.md)s. It accepts instances or raw wire data and always stores instances, so `PixelCommandApplier` can reuse `withRect`/`collapse` rather than re-deriving region state server-side.

```ts
uvRegions.get(id: string): UVRegion | undefined
uvRegions.set(region: UVRegion | UVRegionData): void   // upserts by region.id
uvRegions.remove(id: string): void
```

Implements `Symbol.iterator`: use `[...uvRegions]` to get all regions (as `PixelSyncServer.snapshot()` does).

## Hooks

The hook event shape is also the network command vocabulary - every event maps directly to a network payload.

| Action | Key fields | Notes |
|---|---|---|
| `"stroke"` | `color`, `positions` | Covers a full paint stroke, not per-stamp |
| `"resized"` | `size` | |
| `"texture-replaced"` | `size`, `pixels` (base64) | |
| `"global-fill"` | `fromColor`, `toColor` | No position list; peers recompute from their own buffer |
| `"select-edit"` | `positions`, `colors` (per-pixel) | Unlike `"stroke"`, colors are heterogeneous |
| `"uv-region-created"` | `region` (full `UVRegionData`) | |
| `"uv-region-deleted"` | `id` | |
| `"uv-region-moved"` | `id`, `face`, `rect` | `face` is `null` for a collapsed region |
| `"uv-region-state-changed"` | `region` (full `UVRegionData`) | A collapse/uncollapse; rewrites every face at once |

All events carry an optional `originTimestamp`, set only during `undo()`/`redo()` replay so the network conflict policy (see [PixelSyncServer](../network/PixelSyncServer.md#conflict-policy-minimal)) re-races the edit at its original time instead of treating it as new.

> [!NOTE]
> `"global-fill"` bypasses per-pixel conflict resolution. Undoing it locally replays as a full-position `"stroke"` since exact undo requires knowing which pixels were touched.

