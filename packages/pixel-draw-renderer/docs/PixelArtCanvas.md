# PixelArtCanvas

`PixelArtCanvas` is the top-level coordinator for the pixel-draw renderer and the package's primary public API.

It wires together a viewport, canvas buffer, renderer, input handling, and SVG overlay (all internal implementation details) and owns:

- the [`Brush`](./tools/Brush.md) tool
- the [`UVMap`](./uv/UVMap.md) value object (`"uv"` mode)
- internal line/fill/select tools (no public class of their own)
- an internal `History` wrapping a [`HistoryStack`](./history/HistoryStack.md) for undo/redo

> [!IMPORTANT]
> `History` is constructed unconditionally, but only records entries when `history.enabled` is passed. Leaving it unset skips that bookkeeping entirely.

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
    default?: number;
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
     * Explicit color for the pixels vacated by a Delete, the source side of
     * a Move, or the footprint a Rotate/Flip no longer occupies, in
     * "select" mode — overrides the smart default below. When omitted, the
     * vacated area is instead filled with the most common color among its
     * neighbors, so it blends into the surrounding artwork, falling back to
     * fully transparent when there are no in-bounds neighbors. Accepts a
     * CSS color string or a colorjs.io `Color` instance.
     * @default dominant neighbor color, transparent as the ultimate fallback
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
   * configurable. Also settable/readable at runtime via the `keybindings`
   * property.
   */
  keybindings?: Partial<KeybindingsMap>;
}
```

`Mode` is `"paint" | "move" | "fill" | "select" | "uv"`. `ColorInput` (`string | Color`, where `Color` is [colorjs.io](https://colorjs.io)'s class) is used throughout the package wherever a color option is accepted: a CSS color string (hex, `rgb()`, `hsl()`, named color, ...) or a `Color` instance. `BrushOptions` is forwarded to the internal `Brush` instance, see [Brush.md](./tools/Brush.md). `PixelBufferHookListener` is described in [buffer/PixelBuffer.md](./buffer/PixelBuffer.md) and [network/index.md](./network/index.md). `KeybindingsMap` is described in [input/Keybindings.md](./input/Keybindings.md).

`history.enabled` (default `false`) tells the internal `History` to back itself with a [`HistoryStack`](./history/HistoryStack.md) that records every stroke, resize, and texture replace, enabling `undo()`/`redo()`. Leaving it disabled skips that bookkeeping entirely: there's no per-edit cost paid for a feature that isn't used.

Undocumented defaults: `texture.size` is `{ x: 64, y: 32 }` (`y` falls back to `x` when only `x` is given), `texture.maxSize` is `2048`, `zoom.default` fits the texture to the container (see above; falls back to `4` if the container has no measurable size yet), `zoom.min`/`zoom.max` are `1`/`32`, `zoom.sensitivity` is `0.1`, `backgroundTransparency.squareSize` is `8`, `backgroundTransparency.colors` is `{ odd: "#999", even: "#666" }`.

The `backgroundColor` option, if given, wins outright. Otherwise it's read from `getComputedStyle(parentHtmlElement).backgroundColor` at construction time, falling back to `#424242` if that's unset or fully transparent. See the `backgroundColor` property below to change it after construction.

## Properties

### `brush`

```ts
readonly brush: Brush
```

The brush instance. Use it to read or change the primary/secondary brush colors, opacity, and size. See [Brush.md](./tools/Brush.md).

### `viewport`

```ts
readonly viewport: DefaultViewport // { readonly zoom: Zoom; readonly camera: Readonly<Vec2>; }
```

Read-only camera/zoom state. `viewport.zoom` is the same `Zoom` value object as the top-level `zoom` accessor below (`.value`, `.min`, `.max`, `.sensitivity`); use `viewport` for coordinate conversions and mutation via the methods below.

### `uv`

```ts
readonly uv: UVMap
```

The `UVMap` value object managing this texture's UV regions (create/delete/move/select, visibility, and a typed event emitter). See [uv/UVMap.md](./uv/UVMap.md).

## Methods

### `mode`

```ts
get mode(): Mode
set mode(mode: Mode)
```

Reads or sets the current interaction mode.

| Mode | Left-click | Right-click |
|---|---|---|
| `"paint"` | Brush stroke with `brush.primary`. Hold `Shift` to arm a straight-line tool (always drawn in `primary`). | Brush stroke with `brush.secondary`. |
| `"move"` | Pans the camera. | N/A |
| `"fill"` | Paint-bucket fill from the clicked pixel with `brush.primary`. | Same fill with `brush.secondary`. |
| `"select"` | Drag to select or move a rectangle. | N/A |
| `"uv"` | Click a visible UV region to select/drag it. `Delete` deletes the selected region. | N/A |

- `"paint"`: the two buttons are mutually exclusive, a stroke already in progress on one button blocks the other from starting until it ends.
- `"fill"`: fills the clicked pixel's contiguous region by default, or every same-colored pixel on the canvas when `tools.fill.global` is `true` (see below). A fill click is single-shot and not tracked as a drag, so, unlike `"paint"`, the two buttons aren't mutually exclusive.
- `"select"`: `Ctrl`/`Cmd`+`C`/`V` copies/duplicates, `Delete` erases, `R` rotates the selection 90° clockwise around its center (repeatable: press again for further rotation; no counterclockwise binding), `H`/`V` flips the selection's content horizontally/vertically in place. A drag that never grows past its starting pixel (a plain click) does not create a selection. Like `"uv"`, the cursor is `"grab"` once a selection exists (idle) and `"grabbing"` while it's being dragged to a new position — drawing a brand-new rectangle keeps the plain cursor, since that isn't a grab motion.
- `"uv"`: there is no click-to-create gesture — regions are created via `uv.create(...)` (see [uv/UVMap.md](./uv/UVMap.md)). Only *visible* regions (per `uv.showAll`/`uv.selectedRegionId`) can be hit-tested; clicking empty canvas space (or an invisible region) deselects. The canvas cursor is `"grab"` while idle in this mode and `"grabbing"` while a region is actively being dragged, reverting to the browser default in any other mode. `Delete` only deletes the selected UV region while actually in `"uv"` mode — since a UV selection, unlike a `"select"`-mode selection, persists across mode changes (see the note below), `Delete` pressed in another mode acts only on that mode's own selection, if any, and leaves the UV region alone.

> [!IMPORTANT]
> - The line tool and UV drag handling stay internal; the brush, fill, and select tools expose a narrow public surface via [`tools`](#tools).
> - Switching to `"move"` cancels an armed line. Switching away from `"select"` clears any active selection. Switching away from `"uv"` cancels an in-progress drag but, unlike `"select"`, does **not** clear the UV selection/visibility — see [uv/UVMap.md](./uv/UVMap.md).
> - The SVG brush-cursor highlight is active only in `"paint"` and `"fill"`. In `"fill"`, and in `"paint"` while `tools.brush.pickArmed` is `true`, the highlight is always a single pixel regardless of `brush`'s configured size, since neither a fill's seed nor a color pick is brush-sized.

---

### `tools`

```ts
readonly tools: Toolset  // { brush: BrushTool; fill: FillTool; select: SelectTool }
```

Narrow public view of the drawing tools — the single source of truth for runtime tool state that has no constructor option (each setting persists across mode switches, mirroring `brush`'s size/color). Documented per tool:

- [`tools.brush`](./tools/BrushTool.md) — color picking: `pickArmed`, `pick(x, y)`.
- [`tools.fill`](./tools/FillTool.md) — contiguous vs. global fill: `global`.
- [`tools.select`](./tools/SelectTool.md) — shape sub-mode and transforms: `shape`, `hasSelection`, `rotate()`, `flipHorizontal()`, `flipVertical()`.

The line tool and UV drag handling stay internal; the UV *model* is exposed separately as [`uv`](./uv/UVMap.md).

---

### `backgroundColor`

```ts
get backgroundColor(): string
set backgroundColor(color: ColorInput)
```

Reads or changes the fill color for the canvas area outside the texture bounds; see the `backgroundColor` constructor option above for how the initial value is resolved. The setter takes effect immediately (redraws the canvas itself); no `drawFrame()` call needed.

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
commitPixels(pixels: Vec2[], slot?: BrushColorSlot): void
```

Commits an already-computed pixel set as a single atomic edit: one draw call, one redraw, one `"stroke"` hook emission. A no-op when `pixels` is empty. `slot` defaults to `"primary"`; the color used is that slot's current color/opacity.

Used internally by the line tool (a whole rasterized line committed in one operation instead of redrawing once per point, always `"primary"`) and the fill tool (a flood-filled region committed in one shot, `"primary"` for a left-click / `"secondary"` for a right-click).

---

### `undo` / `redo` / `canUndo` / `canRedo`

```ts
undo(): boolean
redo(): boolean
canUndo(): boolean
canRedo(): boolean
```

Reverts/re-applies the most recent local edit (stroke, resize, texture replace, or UV region create/delete/move) via the internal `History`, which wraps a [`HistoryStack`](./history/HistoryStack.md).

- `undo()`/`redo()` return `false` and do nothing when `history.enabled` wasn't passed at construction, or when the corresponding stack is empty.
- `canUndo()`/`canRedo()` report the same condition without mutating anything.
- Both are bound to the configurable undo/redo keybindings by default; see [input/Keybindings.md](./input/Keybindings.md).

A successful call redraws the canvas, calls `onDrawEnd`, and fires `onHistoryChange`.

> [!IMPORTANT]
> - For a history-enabled `PixelArtCanvas` attached to a `PixelSyncSession`, a successful `undo()`/`redo()` also emits the reverted/re-applied state through `onBufferUpdated` so peers converge to the same result (the replayed event's `originTimestamp` keeps that fair under conflict resolution; see [buffer/PixelBuffer.md](./buffer/PixelBuffer.md)). **Exception:** undoing/redoing a `"select"`-mode edit (move/delete/paste/rotate/flip) never emits `onBufferUpdated`, since those edits aren't networked in the first place, so their undo/redo is local-only. A UV region create/delete/move **is** networked: undo/redo just calls the matching `UVMap` method, which emits the same event a live change would, and that's what feeds `onBufferUpdated`; see [uv/UVMap.md](./uv/UVMap.md#history--network).
> - A remote resize, texture-replace, or snapshot load clears the local history stack (its recorded positions/sizes no longer describe the buffer), so `canUndo()`/`canRedo()` drop to `false` afterward.

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
get zoom(): Zoom
```

Returns the `Zoom` value object (same instance as `viewport.zoom`): `.value` is the current multiplier, `.min`/`.max` are the configured bounds, `.sensitivity` reads or sets the mouse-wheel zoom sensitivity (clamped to a minimum of `0.01`).

---

### `keybindings`

```ts
get keybindings(): Keybindings
```

Returns the `Keybindings` value object (same instance the internal `InputController` matches keydown events against): `.bindings` reads the currently effective set, `.patch(patch)` merges overrides onto it at runtime (actions not present in `patch` keep their current binding). `patch()` throws `InvalidKeybindingError` for a malformed combo string, or `KeybindingConflictError` if the result would bind two actions to the same combo; either way the previous bindings remain in effect. See [input/Keybindings.md](./input/Keybindings.md).

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
loadSnapshot(size: Vec2, pixels: Uint8ClampedArray, uvRegions?: UVRegion[]): void
```

Network sync hooks, used by `PixelSyncSession`. See [network/index.md](./network/index.md). `onBufferUpdated` fires on every local mutation (stroke, resize, texture replace, UV region create/delete/move). `applyRemoteCommand` applies a mutation from a remote peer without re-firing `onBufferUpdated`. `loadSnapshot` hydrates the buffer (and, via `uvRegions`, the `UVMap`) from a network snapshot; it is never itself broadcast.

There is no manual redraw method: every mutation (stroke, pan, zoom, resize, texture replace) triggers its own repaint internally.
