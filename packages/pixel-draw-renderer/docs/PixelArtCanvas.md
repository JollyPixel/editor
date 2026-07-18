# PixelArtCanvas

`PixelArtCanvas` is the top-level coordinator for the pixel-draw renderer, and the package's primary public API. It wires together a viewport, canvas buffer, renderer, input handling, and SVG overlay — all internal implementation details — and owns the [`Brush`](./tools/Brush.md) tool, internal line/fill/select tools, and an internal `HistoryController` that wraps a [`HistoryStack`](./history/HistoryStack.md) for undo/redo (constructed unconditionally; only records entries when `history.enabled` is passed).

## Types

```ts
new PixelArtCanvas(parentHtmlElement: HTMLDivElement, options?: PixelArtCanvasOptions)

interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

interface PixelArtCanvasOptions {
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
  /**
   * Fill color for the canvas area outside the texture bounds (the "void"
   * around the drawing surface). Defaults to the parent element's own CSS
   * `background-color` if it's set and non-transparent, else `#424242`.
   */
  backgroundColor?: ColorInput;
  brush?: BrushOptions;
  select?: {
    /**
     * Color used to fill the pixels vacated by a Delete, the source side of
     * a Move, or the footprint a Rotate/Flip no longer occupies, in
     * "select" mode. Accepts a CSS color string or a colorjs.io `Color`
     * instance.
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
  onHistoryChange?: (state: HistoryState) => void;
  /**
   * Overrides for the copy/paste/undo/redo/delete key combos. Unspecified
   * actions keep their default binding. Shift (line-tool arm/disarm) is not
   * configurable. Also settable/readable at runtime via `patchKeybindings()` /
   * `keybindings`.
   */
  keybindings?: Partial<Keybindings>;
}
```

`Mode` is `"paint" | "move" | "fill" | "select"`. `ColorInput` (`string | Color`, where `Color` is [colorjs.io](https://colorjs.io)'s class) is used throughout the package wherever a color option is accepted: a CSS color string (hex, `rgb()`, `hsl()`, named color, ...) or a `Color` instance. `BrushOptions` is forwarded to the internal `Brush` instance, see [Brush.md](./tools/Brush.md). `PixelBufferHookListener` is described in [buffer/PixelBuffer.md](./buffer/PixelBuffer.md) and [network/index.md](./network/index.md). `Keybindings` is described in [utils/keybindings.md](./utils/keybindings.md).

`history.enabled` (default `false`) tells the internal `HistoryController` to back itself with a [`HistoryStack`](./history/HistoryStack.md) that records every stroke, resize, and texture replace, enabling `undo()`/`redo()`. Leaving it disabled skips that bookkeeping entirely — there's no per-edit cost paid for a feature that isn't used.

Undocumented defaults: `texture.size` is `{ x: 64, y: 32 }` (`y` falls back to `x` when only `x` is given), `texture.maxSize` is `2048`, `zoom.default` is `4`, `zoom.min`/`zoom.max` are `1`/`32`, `zoom.sensitivity` is `0.1`, `backgroundTransparency.squareSize` is `8`, `backgroundTransparency.colors` is `{ odd: "#999", even: "#666" }`.

The `backgroundColor` option, if given, wins outright. Otherwise it's read from `getComputedStyle(parentHtmlElement).backgroundColor` at construction time, falling back to `#424242` if that's unset or fully transparent. See the `backgroundColor` property below to change it after construction.

## Properties

### `brush`

```ts
readonly brush: Brush
```

The brush instance. Use it to read or change the current brush color, opacity, and size. See [Brush.md](./tools/Brush.md).

### `viewport`

```ts
readonly viewport: DefaultViewport // { readonly zoom: Zoom; readonly camera: Readonly<Vec2>; }
```

Read-only camera/zoom state. `viewport.zoom` is a `Zoom` value object (`.value`, `.min`, `.max`, `.sensitivity`), not a plain number — use the top-level `zoom`/`zoomSensitivity` accessors below for the numeric level, or the methods below for coordinate conversions and mutation.

## Methods

### `mode`

```ts
get mode(): Mode
set mode(mode: Mode)
```

Reads or sets the current interaction mode. `"paint"` routes left-click events to brush drawing (holding `Shift` arms a line tool); `"move"` routes them to panning; `"fill"` routes a left-click to a paint-bucket fill (contiguous region by default, or every same-colored pixel on the canvas when `fillGlobal` is `true` — see below); `"select"` routes them to a rectangle-selection tool: drag to select or move, `Ctrl`/`Cmd`+`C`/`V` to copy/duplicate, `Delete` to erase, `R` to rotate the selection 90° clockwise around its center (repeatable — press again for further rotation; no counterclockwise binding), `H`/`V` to flip the selection's content horizontally/vertically in place. The line/fill/select tools are internal implementation details with no public class of their own.

A drag that never grows past its starting pixel (a plain click) does not create a selection.

Switching to `"move"` cancels an armed line. Switching away from `"select"` clears any active selection.

Right-click (color pick) and the SVG brush-cursor highlight are both active in `"paint"` and `"fill"` modes. In `"fill"`, the highlight is always a single pixel regardless of `brush`'s configured size, since a fill's seed is never brush-sized.

---

### `fillGlobal`

```ts
get fillGlobal(): boolean
set fillGlobal(global: boolean)
```

Reads or sets whether `"fill"` mode recolors every pixel matching the seed's color anywhere on the canvas (`true`) instead of only the seed's 4-directionally connected region (`false`, the default). Runtime-only — there is no constructor option — and the setting persists across mode switches, mirroring `brush`'s size/color.

A global fill is still committed and undoable as a single atomic edit, but is broadcast over `onBufferUpdated`/the network layer as a compact `"global-fill"` event (`{ fromColor, toColor }`, no position list) rather than `"stroke"`, since it can touch a large fraction of the canvas — see [buffer/PixelBuffer.md](./buffer/PixelBuffer.md). Undoing/redoing a global fill falls back to a full-position `"stroke"` event.

---

### `backgroundColor`

```ts
get backgroundColor(): string
set backgroundColor(color: ColorInput)
```

Reads or changes the fill color for the canvas area outside the texture bounds — see the `backgroundColor` constructor option above for how the initial value is resolved. The setter takes effect immediately (redraws the canvas itself); no `drawFrame()` call needed.

---

### `textureSize`

```ts
get textureSize(): Vec2
set textureSize(size: Vec2)
```

Reads or changes the current texture size. Setting it resizes the working buffer (content beyond the previous bounds is lost unless it was already committed to the master buffer) and emits a `"resized"` hook event.

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

Reverts/re-applies the most recent local edit (stroke, resize, or texture replace) via the internal `HistoryController`, which wraps a [`HistoryStack`](./history/HistoryStack.md). `undo()`/`redo()` return `false` and do nothing when `history.enabled` wasn't passed at construction, or when the corresponding stack is empty; `canUndo()`/`canRedo()` report the same condition without mutating anything. Both bound to the configurable undo/redo keybindings by default, see [utils/keybindings.md](./utils/keybindings.md).

A successful `undo()`/`redo()` redraws the canvas, calls `onDrawEnd`, fires `onHistoryChange`, and — for a history-enabled `PixelArtCanvas` attached to a `PixelSyncSession` — emits the reverted/re-applied state through `onBufferUpdated` so peers converge to the same result (see [buffer/PixelBuffer.md](./buffer/PixelBuffer.md) for how the replayed event's `originTimestamp` keeps that fair under conflict resolution). The one exception: undoing/redoing a `"select"`-mode edit (move/delete/paste/rotate/flip) never emits `onBufferUpdated`, since those edits aren't networked in the first place (see `mode`/select-mode note above) — undo/redo for them is local-only.

A remote resize, texture-replace, or snapshot load clears the local history stack (its recorded positions/sizes no longer describe the buffer), so `canUndo()`/`canRedo()` drop to `false` after one.

---

### `rotateSelection` / `flipSelectionHorizontal` / `flipSelectionVertical`

```ts
rotateSelection(): boolean
flipSelectionHorizontal(): boolean
flipSelectionVertical(): boolean
```

Programmatic equivalents of the `R`/`H`/`V` select-mode keybindings (e.g. for a toolbar button) — same underlying commit path, so keyboard and button can't drift apart. Each returns `false` and does nothing without an active `"select"`-mode selection.

---

### `texture`

```ts
get texture(): Uint8ClampedArray
set texture(source: HTMLCanvasElement | HTMLImageElement)
```

Reads the current texture's raw RGBA pixel data (row-major, 4 bytes per pixel), or replaces the texture with the pixel data from `source`, resizing to match and emitting a `"texture-replaced"` hook event.

---

### `textureCanvas`

```ts
textureCanvas(): HTMLCanvasElement
```

Returns the working (texture-resolution, off-screen) canvas backing the buffer.

---

### `canvas`

```ts
canvas(): HTMLCanvasElement
```

Returns the visible (viewport-cropped, on-screen) canvas element that `InputController` listens on. Useful for attaching additional event listeners or overlays.

---

### `camera`

```ts
get camera(): Vec2
```

Returns a copy of the current camera offset `{ x, y }` in viewport space.

---

### `zoom`

```ts
get zoom(): number
```

Returns the current zoom multiplier.

---

### `zoomSensitivity`

```ts
get zoomSensitivity(): number
set zoomSensitivity(sensitivity: number)
```

Reads or sets the mouse-wheel zoom sensitivity (clamped to a minimum of `0.01`).

---

### `keybindings` / `patchKeybindings`

```ts
get keybindings(): Readonly<Keybindings>
patchKeybindings(patch: Partial<Keybindings>): void
```

Reads the currently effective keybindings, or merges `patch` onto them (actions not present in `patch` keep their current binding). Throws `InvalidKeybindingError` for a malformed combo string, or `KeybindingConflictError` if the result would bind two actions to the same combo — either way the previous keybindings remain in effect. See [utils/keybindings.md](./utils/keybindings.md).

---

### `centerTexture`

```ts
centerTexture(): void
```

Pans and clamps the camera so the texture is centered in the current viewport.

---

### `parentHtmlElement` / `reparentCanvasTo`

```ts
get parentHtmlElement(): HTMLDivElement
reparentCanvasTo(newParentElement: HTMLDivElement): void
```

Reads the current parent element, or call `reparentCanvasTo` to move the working canvas and the SVG overlay into a new one and re-read its dimensions. Call `reparentCanvasTo` when mounting the editor into a new DOM container.

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
