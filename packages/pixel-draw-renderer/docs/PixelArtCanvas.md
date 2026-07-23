# PixelArtCanvas

Top-level coordinator. Primary public API. Wires together viewport, canvas buffer, renderer, input, and SVG overlay. Owns the [`Brush`](./tools/Brush.md), [`UVMap`](./uv/UVMap.md), line/fill/select tools, and the undo/redo `History`.

## Constructor

```ts
new PixelArtCanvas(
  parentHtmlElement: HTMLDivElement,
  options?: PixelArtCanvasOptions
)
```

## Types

```ts
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
      y?: number;   // falls back to x when omitted; default: { x: 64, y: 32 }
    };
    maxSize?: number;  // default: 2048
    init?: HTMLCanvasElement;
  };
  zoom?: {
    default?: number;   // fits texture to container; falls back to 4 if container has no size
    sensitivity?: number;  // default: 0.1
    min?: number;  // default: 1
    max?: number;  // default: 32
  };
  backgroundTransparency?: {
    colors: { odd: string; even: string; };  // default: { odd: "#999", even: "#666" }
    squareSize: number;  // default: 8
  };
  /**
   * Fill color for the canvas area outside the texture bounds (the "void"
   * around the drawing surface). Defaults to the parent element''s own CSS
   * `background-color` if it''s set and non-transparent, else `#424242`.
   */
  backgroundColor?: ColorInput;
  brush?: BrushOptions;
  select?: {
    /**
     * Explicit color for the pixels vacated by a Delete, the source side of
     * a Move, or the footprint a Rotate/Flip no longer occupies, in
     * "select" mode - overrides the smart default below. When omitted, the
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

- `Mode` → `"paint" | "move" | "fill" | "select" | "uv"`. `ColorInput` → `string | Color` ([colorjs.io](https://colorjs.io)).
- `BrushOptions` → [Brush.md](./tools/Brush.md).
- `PixelBufferHookListener` → [buffer/PixelBuffer.md](./buffer/PixelBuffer.md).
- `KeybindingsMap` → [input/Keybindings.md](./input/Keybindings.md).

## Properties

### `brush`

```ts
readonly brush: Brush
```

Primary/secondary colors, opacity, size. See [Brush.md](./tools/Brush.md).

### `viewport`

```ts
readonly viewport: DefaultViewport // { readonly zoom: Zoom; readonly camera: Readonly<Vec2>; }
```

Read-only camera/zoom state. Same `Zoom` instance as the `zoom` accessor below.

### `uv`

```ts
readonly uv: UVMap
```

UV regions: create/delete/move/select, visibility, typed events. See [uv/UVMap.md](./uv/UVMap.md).

## Methods

### `mode`

```ts
get mode(): Mode
set mode(mode: Mode)
```

| Mode | Left-click | Right-click |
|---|---|---|
| `"paint"` | Stroke with `brush.primary`. Hold `Shift` for straight-line. | Stroke with `brush.secondary`. |
| `"move"` | Pan camera. | — |
| `"fill"` | Flood-fill with `brush.primary`. | Same with `brush.secondary`. |
| `"select"` | Drag to select/move rectangle. `Ctrl+C/V` copy/paste, `Delete` erase, `R` rotate 90°, `H`/`V` flip. | — |
| `"uv"` | Click visible region to select/drag. `Delete` removes it. Regions created via `uv.create(...)`. | — |

Navigation works in any mode: wheel zooms, middle-drag or `Space`+left-drag pans.

> [!IMPORTANT]
> Leaving `"paint"` cancels an armed line. Leaving `"select"` clears the selection. Leaving `"uv"` cancels an in-progress drag but **does not** clear the UV selection.

---

### `tools`

```ts
readonly tools: Toolset  // { brush: BrushTool; fill: FillTool; select: SelectTool }
```

Runtime tool state that has no constructor option. Persists across mode switches.

- [`tools.brush`](./tools/BrushTool.md) — `pickArmed`, `pick(x, y)`
- [`tools.fill`](./tools/FillTool.md) — `global` (contiguous vs. whole-canvas fill)
- [`tools.select`](./tools/SelectTool.md) — `shape`, `hasSelection`, `rotate()`, `flipHorizontal()`, `flipVertical()`

---

### `backgroundColor`

```ts
get backgroundColor(): string
set backgroundColor(color: ColorInput)
```

Canvas void color. Redraws immediately on set.

---

### `textureSize`

```ts
get textureSize(): Vec2
set textureSize(size: Vec2)
```

Resize the working buffer. Content beyond previous bounds is lost. Emits `"resized"`.

---

### `commitPixels`

```ts
commitPixels(pixels: Vec2[], slot?: BrushColorSlot): void
```

Commits a pre-computed pixel set as one atomic edit. No-op when `pixels` is empty. `slot` defaults to `"primary"`.

---

### `undo` / `redo` / `canUndo` / `canRedo`

```ts
undo(): boolean
redo(): boolean
canUndo(): boolean
canRedo(): boolean
```

Requires `history.enabled` at construction — returns `false` otherwise. A successful call redraws, calls `onDrawEnd`, and fires `onHistoryChange`.

> [!IMPORTANT]
> A remote resize, texture-replace, or snapshot load clears the local history stack.

---

### `texture`

```ts
get texture(): Uint8ClampedArray
set texture(source: HTMLCanvasElement | HTMLImageElement)
```

Get raw RGBA pixel data, or replace the texture from a canvas/image (resizes to match, emits `"texture-replaced"`).

---

### `textureCanvas`

```ts
textureCanvas(): HTMLCanvasElement
```

The off-screen canvas backing the buffer.

---

### `canvas`

```ts
canvas(): HTMLCanvasElement
```

The visible on-screen canvas element. Useful for attaching extra event listeners.

---

### `camera`

```ts
get camera(): Vec2
```

Current camera offset `{ x, y }` in viewport space.

---

### `zoom`

```ts
get zoom(): Zoom
```

`Zoom` value object: `.value`, `.min`, `.max`, `.sensitivity` (min `0.01`). Same instance as `viewport.zoom`.

---

### `keybindings`

```ts
get keybindings(): Keybindings
```

`.bindings` reads the current set; `.patch(patch)` merges overrides at runtime. Throws `InvalidKeybindingError` or `KeybindingConflictError` on bad input — previous bindings stay. See [input/Keybindings.md](./input/Keybindings.md).

---

### `centerTexture`

```ts
centerTexture(): void
```

Centers the texture in the viewport.

---

### `parentHtmlElement` / `reparentCanvasTo`

```ts
get parentHtmlElement(): HTMLDivElement
reparentCanvasTo(newParentElement: HTMLDivElement): void
```

Read or move the canvas + SVG overlay into a new DOM container.

---

### `onResize`

```ts
onResize(): void
```

Re-reads parent dimensions and resizes the canvas/overlay to fill it. Call on `window.resize`. No-op if parent has zero size.

---

### `destroy`

```ts
destroy(): void
```

Removes event listeners and unmounts canvas + overlay from the DOM.

---

### `onBufferUpdated` / `applyRemoteCommand` / `loadSnapshot`

```ts
get onBufferUpdated(): PixelBufferHookListener | undefined
set onBufferUpdated(fn: PixelBufferHookListener | undefined)
applyRemoteCommand(event: PixelBufferHookEvent): void
loadSnapshot(size: Vec2, pixels: Uint8ClampedArray, uvRegions?: UVRegion[]): void
```

Network sync hooks — used by `PixelSyncSession`. `applyRemoteCommand` applies a remote mutation without re-firing `onBufferUpdated`. `loadSnapshot` hydrates buffer + UV from a snapshot (never broadcast). See [network/index.md](./network/index.md).
