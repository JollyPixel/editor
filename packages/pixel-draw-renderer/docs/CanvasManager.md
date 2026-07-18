# CanvasManager

`CanvasManager` is the top-level coordinator for the pixel-draw renderer, and the package's primary public API. It wires together a viewport, canvas buffer, renderer, input handling, and SVG overlay — all internal implementation details — and owns the [`Brush`](./tools/Brush.md) tool, internal line/fill/select tools, and (when enabled) a [`HistoryStack`](./history/HistoryStack.md) for undo/redo.

## Types

```ts
new CanvasManager(parentHtmlElement: HTMLDivElement, options?: CanvasManagerOptions)

interface CanvasManagerOptions {
  /**
   * Default interaction mode for the canvas.
   * "paint" for drawing, "move" for panning, or "fill" for the paint-bucket
   * flood-fill tool. If not specified, the default mode will be "paint".
   */
  defaultMode?: Mode;
  /**
   * Global event target used by InputController for drag-continuation
   * mouse tracking and keyboard/blur reporting.
   * @default window
   */
  window?: WindowLike;
  texture?: {
    defaultColor?: ColorInput;
    size?: {
      x: number;
      y?: number;
    };
    maxSize?: number;
    init?: HTMLCanvasElement;
  };
  zoom?: {
    default: number;
    sensitivity?: number;
    min?: number;
    max?: number;
  };
  backgroundTransparency?: {
    colors: { odd: string; even: string; };
    squareSize: number;
  };
  brush?: BrushOptions;
  select?: {
    /**
     * Color used to fill the pixels vacated by a Delete or the source side
     * of a Move in "select" mode. Accepts a CSS color string or a colorjs.io
     * `Color` instance.
     * @default "#FFFFFF"
     */
    eraseColor?: ColorInput;
  };
  /**
   * Called after a draw stroke is committed to the master buffer.
   * Use this hook to synchronize the edited texture with an external consumer.
   */
  onDrawEnd?: () => void;
  /**
   * Called for every local mutation (stroke, resize, texture replace).
   * Used by PixelSyncSession to forward mutations over the network.
   */
  onBufferUpdated?: PixelBufferHookListener;
  /** Local undo/redo stack. Disabled by default. */
  history?: {
    enabled?: boolean;
    /** @default 10 */
    limit?: number;
  };
  /** Called whenever the undo/redo stack changes (after push, undo, redo, or clear). */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean; }) => void;
  /**
   * Overrides for the copy/paste/undo/redo/delete key combos. Unspecified
   * actions keep their default binding. Shift (line-tool arm/disarm) is not
   * configurable. Also settable/readable at runtime via `setKeybindings()` /
   * `getKeybindings()`.
   */
  keybindings?: Partial<Keybindings>;
}
```

`Mode` is `"paint" | "move" | "fill" | "select"`. `ColorInput` (`string | Color`, where `Color` is [colorjs.io](https://colorjs.io)'s class) is used throughout the package wherever a color option is accepted: a CSS color string (hex, `rgb()`, `hsl()`, named color, ...) or a `Color` instance. `BrushOptions` is forwarded to the internal `Brush` instance, see [Brush.md](./tools/Brush.md). `PixelBufferHookListener` is described in [buffer/PixelBuffer.md](./buffer/PixelBuffer.md) and [network/index.md](./network/index.md). `Keybindings` is described in [utils/keybindings.md](./utils/keybindings.md).

`history.enabled` (default `false`) creates an internal [`HistoryStack`](./history/HistoryStack.md) that records every stroke, resize, and texture replace, enabling `undo()`/`redo()`. Leaving it disabled skips that bookkeeping entirely — there's no per-edit cost paid for a feature that isn't used.

Undocumented defaults: `texture.size` is `{ x: 64, y: 32 }` (`y` falls back to `x` when only `x` is given), `texture.maxSize` is `2048`, `zoom.default` is `4`, `zoom.min`/`zoom.max` are `1`/`32`, `zoom.sensitivity` is `0.1`, `backgroundTransparency.squareSize` is `8`, `backgroundTransparency.colors` is `{ odd: "#999", even: "#666" }`.

The background color used behind transparent texture pixels is read from `getComputedStyle(parentHtmlElement).backgroundColor` at construction time (falling back to `#555555` if unset or fully transparent); it isn't a configurable option.

## Properties

### `brush`

```ts
readonly brush: Brush
```

The brush instance. Use it to read or change the current brush color, opacity, and size. See [Brush.md](./tools/Brush.md).

### `viewport`

```ts
readonly viewport: DefaultViewport // { readonly zoom: number; readonly camera: Readonly<Vec2>; }
```

Read-only camera/zoom state. Use `getCamera()`/`getZoom()` for copies, or the methods below for coordinate conversions and mutation.

## Methods

### `getMode` / `setMode`

```ts
getMode(): Mode
setMode(mode: Mode): void
```

Returns or sets the current interaction mode. `"paint"` routes left-click events to brush drawing (holding `Shift` arms a line tool); `"move"` routes them to panning; `"fill"` routes a left-click to a paint-bucket flood fill; `"select"` routes them to a rectangle-selection tool: drag to select or move, `Ctrl`/`Cmd`+`C`/`V` to copy/duplicate, `Delete` to erase. The line/fill/select tools are internal implementation details with no public class of their own.

Switching to `"move"` cancels an armed line. Switching away from `"select"` clears any active selection.

---

### `getTextureSize` / `setTextureSize`

```ts
getTextureSize(): Vec2
setTextureSize(size: Vec2): void
```

Returns or changes the current texture size. `setTextureSize` resizes the working buffer (content beyond the previous bounds is lost unless it was already committed to the master buffer) and emits a `"resized"` hook event.

---

### `commitPixels`

```ts
commitPixels(pixels: Vec2[]): void
```

Commits an already-computed pixel set as a single atomic edit: one draw call, one redraw, one `"stroke"` hook emission. Used internally by the line tool to commit a whole rasterized line in one operation instead of redrawing once per point, and by the fill tool to commit a flood-filled region in one shot. A no-op when `pixels` is empty. The color used is the brush's current color/opacity.

---

### `undo` / `redo` / `canUndo` / `canRedo`

```ts
undo(): boolean
redo(): boolean
canUndo(): boolean
canRedo(): boolean
```

Reverts/re-applies the most recent local edit (stroke, resize, or texture replace) via the internal [`HistoryStack`](./history/HistoryStack.md). `undo()`/`redo()` return `false` and do nothing when `history.enabled` wasn't passed at construction, or when the corresponding stack is empty; `canUndo()`/`canRedo()` report the same condition without mutating anything. Both bound to the configurable undo/redo keybindings by default, see [utils/keybindings.md](./utils/keybindings.md).

A successful `undo()`/`redo()` redraws the canvas, calls `onDrawEnd`, fires `onHistoryChange`, and — for a history-enabled `CanvasManager` attached to a `PixelSyncSession` — emits the reverted/re-applied state through `onBufferUpdated` so peers converge to the same result (see [buffer/PixelBuffer.md](./buffer/PixelBuffer.md) for how the replayed event's `originTimestamp` keeps that fair under conflict resolution).

A remote resize, texture-replace, or snapshot load clears the local history stack (its recorded positions/sizes no longer describe the buffer), so `canUndo()`/`canRedo()` drop to `false` after one.

---

### `setTexture`

```ts
setTexture(source: HTMLCanvasElement | HTMLImageElement): void
```

Replaces the texture with the pixel data from `source`, resizing to match, and emits a `"texture-replaced"` hook event.

---

### `getTexture`

```ts
getTexture(): Uint8ClampedArray
```

Returns the current texture's raw RGBA pixel data (row-major, 4 bytes per pixel).

---

### `getTextureCanvas`

```ts
getTextureCanvas(): HTMLCanvasElement
```

Returns the working (texture-resolution, off-screen) canvas backing the buffer.

---

### `getCanvas`

```ts
getCanvas(): HTMLCanvasElement
```

Returns the visible (viewport-cropped, on-screen) canvas element that `InputController` listens on. Useful for attaching additional event listeners or overlays.

---

### `getCamera`

```ts
getCamera(): Vec2
```

Returns a copy of the current camera offset `{ x, y }` in viewport space.

---

### `getZoom`

```ts
getZoom(): number
```

Returns the current zoom multiplier.

---

### `getZoomSensitivity` / `setZoomSensitivity`

```ts
getZoomSensitivity(): number
setZoomSensitivity(sensitivity: number): void
```

Returns or sets the mouse-wheel zoom sensitivity (clamped to a minimum of `0.01`).

---

### `getKeybindings` / `setKeybindings`

```ts
getKeybindings(): Readonly<Keybindings>
setKeybindings(patch: Partial<Keybindings>): void
```

Returns the currently effective keybindings, or merges `patch` onto them (actions not present in `patch` keep their current binding). Throws `InvalidKeybindingError` for a malformed combo string, or `KeybindingConflictError` if the result would bind two actions to the same combo — either way the previous keybindings remain in effect. See [utils/keybindings.md](./utils/keybindings.md).

---

### `centerTexture`

```ts
centerTexture(): void
```

Pans and clamps the camera so the texture is centered in the current viewport.

---

### `getParentHtmlElement` / `reparentCanvasTo`

```ts
getParentHtmlElement(): HTMLDivElement
reparentCanvasTo(newParentElement: HTMLDivElement): void
```

Returns the current parent element, or moves the working canvas and the SVG overlay into a new one and re-reads its dimensions. Call `reparentCanvasTo` when mounting the editor into a new DOM container.

---

### `onResize`

```ts
onResize(): void
```

Reads the current dimensions of the parent element and resizes the visible canvas/SVG overlay to fill it. No-op if the parent has zero width or height (e.g. hidden via `display: none`). Call this after the parent element changes size (e.g. on `window.resize`).

---

### `destroy`

```ts
destroy(): void
```

Tears down `InputController`'s event listeners and removes the canvas and SVG overlay from the DOM.

---

### `onBufferUpdated` / `applyRemoteCommand` / `loadSnapshot`

```ts
set onBufferUpdated(fn: PixelBufferHookListener | undefined)
applyRemoteCommand(event: PixelBufferHookEvent): void
loadSnapshot(size: Vec2, pixels: Uint8ClampedArray): void
```

Network sync hooks, used by `PixelSyncSession`. See [network/index.md](./network/index.md). `onBufferUpdated` fires on every local mutation (stroke, resize, texture replace). `applyRemoteCommand` applies a mutation from a remote peer without re-firing `onBufferUpdated`. `loadSnapshot` hydrates the buffer from a network snapshot; it is never itself broadcast.

There is no manual redraw method: every mutation (stroke, pan, zoom, resize, texture replace) triggers its own repaint internally.
