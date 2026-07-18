# PixelBuffer

`PixelBuffer` holds raw RGBA pixel data with no DOM dependency, so it can run in a headless environment (server, tests) as well as behind a Canvas2D adapter in the browser (used internally by `PixelArtCanvas`). It's the buffer type used by [`PixelWorld`](../network/PixelWorld.md) for server-side pixel storage.

It keeps two backing arrays: a `working` buffer at the current texture size, and a `master` buffer pre-allocated at `maxSize × maxSize` that only gets updated on `copyToMaster()`. Growing `working` back up (via `resize`) reads from `master`, so previously committed content beyond a temporarily shrunk size isn't lost.

## Types

```ts
new PixelBuffer(options: PixelBufferOptions)

interface PixelBufferOptions {
  size: Vec2;
  /**
   * Default fill color for newly created pixels. Accepts an RGBA object, a
   * CSS color string (hex, rgb(), hsl(), named color, ...) or a colorjs.io
   * `Color` instance.
   * @default { r: 255, g: 255, b: 255, a: 255 }
   */
  defaultColor?: RGBA | ColorInput;
  /**
   * Size of the backing master buffer. The working buffer can be resized up
   * to this limit without losing data previously committed via copyToMaster.
   * @default 2048
   */
  maxSize?: number;
}
```

Pixel `(0, 0)` is always initialized fully transparent regardless of `defaultColor`.

## Methods

### `size` / `resize`

```ts
size(): Vec2
resize(size: Vec2): void
```

Returns the current working-buffer size, or resizes it. Content is read back from the master buffer at the new dimensions (clipped to `maxSize`).

---

### `pixels`

```ts
pixels(): Uint8ClampedArray
```

Returns the **live** working buffer, not a copy; mutating it mutates the buffer directly. Contrast with `CanvasBuffer.pixels()`, which returns a copy.

---

### `replacePixels`

```ts
replacePixels(pixels: Uint8ClampedArray, size: Vec2): void
```

Replaces the pixel data wholesale, resizing the buffer to match. Used to hydrate from a network snapshot or a decoded image.

---

### `drawPixels`

```ts
drawPixels(positions: Iterable<Vec2>, color: RGBA): void
```

Stamps a single color across a list of positions. Out-of-bounds positions are silently skipped, mirroring Canvas2D's implicit clipping of out-of-bounds `putImageData` calls.

---

### `drawRegion`

```ts
drawRegion(rect: SelectionRect, pixels: RGBA[]): void
```

Writes a rectangular block of per-pixel colors (row-major, `rect.width * rect.height` entries), unlike `drawPixels` which stamps one color across a list of positions. Out-of-bounds positions are skipped, same as `drawPixels`.

---

### `copyToMaster`

```ts
copyToMaster(): void
```

Commits the current working buffer into the master buffer at `(0, 0)`.

---

### `samplePixel`

```ts
samplePixel(x: number, y: number): [number, number, number, number]
```

Returns the `[r, g, b, a]` of the working buffer at `(x, y)`. Out-of-bounds reads return `0` for each component rather than throwing.

## Hooks

```ts
export type PixelBufferHookEvent =
  | {
    action: "stroke";
    metadata: {
      color: RGBA;
      positions: Vec2[];
    };
    originTimestamp?: number;
  }
  | {
    action: "resized";
    metadata: {
      size: Vec2;
    };
    originTimestamp?: number;
  }
  | {
    action: "texture-replaced";
    metadata: {
      size: Vec2;
      pixels: string;
    };
    originTimestamp?: number;
  }
  | {
    action: "global-fill";
    metadata: {
      fromColor: RGBA;
      toColor: RGBA;
    };
    originTimestamp?: number;
  };

type PixelBufferHookAction = PixelBufferHookEvent["action"];
type PixelBufferHookListener = (event: PixelBufferHookEvent) => void;
```

This is the shape of `PixelArtCanvas`'s `onBufferUpdated` local-mutation hook, and the vocabulary the [network layer](../network/index.md) is built on — every event is a valid network command payload once stamped with routing metadata. `"stroke"` covers a whole paint stroke or `commitPixels` call, not one event per brush stamp. `originTimestamp`, set only when `PixelArtCanvas.undo()`/`redo()` replay an edit, carries that edit's original timestamp so the network [conflict resolver](../network/ConflictResolver.md) re-races the replay fairly instead of it always winning by virtue of being freshly stamped; it's stripped before the command is sent over the wire.

`"global-fill"` (emitted by `PixelArtCanvas`'s fill tool when `setFillGlobal(true)`) is deliberately compact — no position list — since it can touch a large fraction of the canvas. Every applier (a remote peer via `applyRemoteCommand`, or [`PixelCommandApplier`](../network/PixelCommandApplier.md) on the server) recomputes the affected pixels itself by scanning its own buffer for `fromColor` and repainting them `toColor`, which is only correct because peers apply commands in the same order against an already-synced buffer. It also bypasses per-pixel conflict resolution (unlike `"stroke"`) — see [network/ConflictResolver.md](../network/ConflictResolver.md). Undoing/redoing a global fill locally still replays as an ordinary full-position `"stroke"` event, since exact undo requires knowing exactly which pixels were touched.
