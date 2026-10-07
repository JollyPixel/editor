# PixelArtCanvas

Creates an editable pixel-art texture inside a DOM element. It exposes drawing tools, texture data, view controls, UV regions and optional history.

```ts
const canvas = new PixelArtCanvas(parent, {
  texture: {
    size: { x: 64, y: 32 }
  },
  history: {
    enabled: true
  }
});

canvas.brush.primary.set("#ff6600");
canvas.mode = "paint";
```

## Constructor

```ts
new PixelArtCanvas(
  parentHtmlElement: HTMLDivElement,
  options?: PixelArtCanvasOptions
)
```

The canvas and its overlays are mounted inside `parentHtmlElement`. See [`PixelArtCanvasOptions`](./PixelArtCanvasOptions.md) for constructor settings and defaults.

## Types

```ts
type Mode = "paint" | "erase" | "move" | "fill" | "select" | "uv";
```

## Core objects

```ts
readonly document: PixelDocument
readonly brush: Brush
readonly tools: Toolset
readonly shortcuts: CanvasShortcuts
readonly uv: UVMap
readonly viewport: CanvasViewport
```

### `document`

The [`PixelDocument`](./PixelDocument.md) behind the canvas: buffer and UV map, plus the `changed` / `resized` / `replaced` events forwarded from [`CanvasBuffer`](./buffer/CanvasBuffer.md). Subscribe here — not to `onDrawEnd` — to mirror the texture elsewhere, such as onto a Three.js material:

```ts
canvas.document.on("changed", ({ bounds }) => texture.markDirty(bounds));
canvas.document.on("replaced", () => {
  texture.image = canvas.textureCanvas();
});
```

`changed` fires for every pixel write, local or remote; the document `command` event fires for local edits only.

### `brush`

Stores the primary and secondary colors, opacity, brush size and cursor colors. See [`Brush`](./tools/Brush.md).

### `tools`

Runtime controls for color picking, fill behavior and selection transforms. See [`Toolset`](./tools/Toolset.md).

### `shortcuts`

Keyboard-driven intents (select all, copy, paste, delete, undo, redo, rotate, flip) and the held pan and line modifiers. The canvas never listens to the keyboard; the host binds keys to these members. See [`CanvasShortcuts`](./input/CanvasShortcuts.md).

### `uv`

Creates, moves and selects texture regions. See [`UVMap`](./uv/UVMap.md).

### `viewport`

Read-only camera and zoom state, plus the canvas element size in screen pixels:

```ts
interface ScreenProjection {
  toScreen(point: Readonly<Vec2>): Vec2;
  toScreenRect(rect: Readonly<SelectionRect>): SelectionRect;
  toTexture(point: Readonly<Vec2>): Vec2;
}

interface DefaultViewport extends ScreenProjection {
  readonly camera: Readonly<Vec2>;
  readonly zoom: Zoom;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

interface CanvasViewport extends DefaultViewport {
  textureClientPosition(
    point: Readonly<Vec2>,
    bounds: Pick<DOMRectReadOnly, "left" | "top">
  ): Vec2;
}
```

`canvasWidth` and `canvasHeight` are `0` until the canvas is first sized, and follow every resize.

`toScreen()` and `toScreenRect()` map texture coordinates to canvas pixels, `toTexture()` maps canvas pixels back to fractional texture coordinates. They follow the current zoom and camera.

`textureClientPosition(point, bounds)` returns the client coordinates of the centre of the texel at `point`, for `bounds` taken from `canvas().getBoundingClientRect()`. It is the inverse of the pointer mapping: a pointer event at the returned position lands on `point`, at any zoom and pan. `point` may lie outside the texture.

```ts
const bounds = canvas.canvas().getBoundingClientRect();
const { x, y } = canvas.viewport.textureClientPosition({ x: 3, y: 5 }, bounds);
```

## Interaction

### `mode`

```ts
get mode(): Mode
set mode(value: Mode)
```

| Mode | Left-click | Right-click |
|---|---|---|
| `"paint"` | Paint with `brush.primary`. Hold [`shortcuts.lineHeld`](./input/CanvasShortcuts.md#lineheld) for a straight line. When the picker is armed, pick into `brush.primary`. | Paint with `brush.secondary`. When the picker is armed, pick into `brush.secondary`; otherwise `Ctrl`+right-click picks into `brush.primary`. |
| `"erase"` | Erase with `brush.erase`. Hold `shortcuts.lineHeld` for a straight line. | Erase, like left-click. |
| `"move"` | Pan the view. | No action. |
| `"fill"` | Fill with `brush.primary`. | Fill with `brush.secondary`. |
| `"select"` | Create or move a selection. | No action. |
| `"uv"` | Select or drag a visible UV region. | No action. |

Erase mode is paint mode writing `brush.erase` (transparent unless [`brush.eraseColor`](./tools/Brush.md#types) says otherwise): same brush size, same footprint, same straight line, but neither mouse button paints a brush color and the color picker stays out of reach.

A stroke keeps the color it started with: changing a brush color mid-drag affects the next stroke. A drag belongs to the button that started it. Pressing the other button during the drag does nothing, and releasing the other button does not end it.

Wheel input zooms in every mode. Middle-drag, or left-drag while [`shortcuts.panHeld`](./input/CanvasShortcuts.md#panheld) is set, pans the view. In paint and erase modes, `Ctrl`+wheel changes `brush.size` by one pixel per scroll direction; it zooms instead while `shortcuts.panHeld` is set. A touchpad pinch arrives as `Ctrl`+wheel input without a held `Ctrl` key and always zooms. The canvas reads the held `Ctrl` key from the keyboard and mouse events reaching its [`window`](./PixelArtCanvasOptions.md#window) and canvas element.

Leaving paint or erase mode cancels an armed line, and leaving paint mode also cancels the color pick. Leaving select mode clears the selection. Leaving UV mode cancels the current drag and keeps the UV selection.

### `textureView` / `pixelsReadOnly` / `unavailableModes`

```ts
type TextureView = "albedo" | "normal";

get textureView(): TextureView
set textureView(value: TextureView)
readonly pixelsReadOnly: boolean;
readonly unavailableModes: ReadonlySet<Mode>;
```

`textureView` picks what the canvas draws: the texture (`"albedo"`, the default) or its generated [normal map](./normal/NormalMap.md) (`"normal"`). It is view state: it is not stored in the document and not synchronized. The normal view retains `document.normals` and releases it when the view goes back to albedo or the canvas is destroyed.

`pixelsReadOnly` is `true` in the normal view. `unavailableModes` holds the modes the current view refuses: empty in the albedo view, `"paint"`, `"erase"` and `"fill"` in the normal view. It returns the same set until the view changes, so it can be bound to a property directly.

The normal view is read-only for pixels:

- `"paint"`, `"erase"` and `"fill"` are unavailable. Entering the view from one of them switches to `"move"`, and setting one of them is ignored. Going back to the albedo view restores that mode, unless another mode was set in the normal view.
- Entering the view clears the selection. A selection can still be drawn and copied, but it does not move, and delete, rotate, flip and `pasteClipboard()` are refused. Paste reports `paste-failed`.
- UV mode works as in the albedo view.

Programmatic writes such as `commitPixels()`, `clearTexture()` and remote commands still apply, and the normal view follows them.

## Texture

```ts
get textureSize(): Vec2
get maxTextureSize(): number
set textureSize(value: Vec2)

get texture(): Uint8ClampedArray
set texture(source: HTMLCanvasElement | HTMLImageElement)

clearTexture(options?: ClearTextureOptions): void

commitPixels(
  pixels: Vec2[],
  slot?: "primary" | "secondary"
): void

hasTransparency(geometry: UVGeometry): boolean
```

### `textureSize`

Gets or resizes the texture. Shrinking hides committed pixels outside the new bounds; growing can restore pixels retained by the master buffer. Dimensions must be positive integers no greater than [`texture.maxSize`](./PixelArtCanvasOptions.md#texturemaxsize); other values throw a `RangeError` and leave the texture and selection unchanged.

`maxTextureSize` exposes that validated limit for import UIs.

### `texture`

The getter returns a copy of the current RGBA pixel data. The setter replaces the texture and resizes it to the source image or canvas.

### `clearTexture()`

```ts
interface ClearTextureOptions {
  includeUV?: boolean;
}
```

Makes pixels transparent. By default, pixels inside a [UV slot](../GLOSSARY.md#uv-slot) are kept; `includeUV: true` clears every pixel. UV regions are never deleted.

Slot membership uses every region, whatever [`UVMap.isVisible()`](./uv/UVMap.md) returns, and only the active slots of each region. A pixel belongs to a slot when its center lies inside the slot geometry, the same rule as `hasTransparency()`.

The clear is one history step and one `texture-replaced` command. The document emits `replaced`.

### `commitPixels()`

Paints a precomputed set of texture coordinates as one edit with the brush color of the slot, `"primary"` by default, through [`document.paintPixels()`](./PixelDocument.md#edits). An empty array does nothing.

### `hasTransparency()`

Returns `true` when any sampled pixel in `geometry` has alpha below `255`. Rectangles use their complete area; triangles and compounds ignore pixels outside their actual UV coverage. Sampled areas outside the texture count as transparent.

## Clipboard

```ts
copySelection(): Promise<ClipboardOperationResult>
pasteClipboard(): Promise<ClipboardOperationResult>
```

Copy requires a completed selection. It stores an internal snapshot immediately, then writes a PNG to the OS clipboard when the Async Clipboard API is available. Supported JollyPixel instances also exchange versioned custom metadata carrying the shape mask and the raw RGBA samples, so a copy and paste between two JollyPixel instances is exact. The PNG remains interoperable with other image editors.

Paste accepts PNG, JPEG, WebP and the first GIF frame. Alpha-zero pixels are excluded from the mask; partial alpha is preserved. An empty image is rejected.

### Placement

Pasted content is centered on the in-bounds texture cursor, or on the center of the visible view when the pointer is off the texture, then pulled inside the texture bounds. Content larger than the texture is pinned to the corresponding edge so its top-left stays visible; the overflow is kept in the selection and can be dragged back into range. Placement is independent of where the content was copied from, so a paste is always visible.

`placeSelection()` is exported for callers that need the same rule.

### Floating selections

A paste lands as a floating selection: pixel-sharp, movable, and not yet written to the buffer. Deselecting it deposits it into the buffer as a single undoable edit. That covers clicking elsewhere, leaving Select mode, and pasting again. `tools.select.delete()` cancels it instead, leaving the texture untouched.

`selectionEvents`'s `selection-state-changed` reports `isFloating` alongside `hasSelection` so a UI can distinguish a pending paste from a plain selection.

### Selection presence

`canvas.selectionPresence` returns a `SelectionPresence` value object for the
current selection, or `null` when no selection exists. Its `toJSON()` method
returns an independent `SelectionPresenceData` snapshot in texture coordinates.

`selectionEvents` emits `selection-presence-changed` with this value whenever
selection geometry, content or lifecycle state changes. This includes gesture
start and end, shape selection, resizing, paste, transforms, deletion, history
restoration and discard. Viewport refreshes do not emit selection changes.
Subscribe before reading the getter when attaching another view.

```ts
canvas.selectionEvents.on("selection-presence-changed", (presence) => {
  renderSelection(presence?.toJSON() ?? null);
});
renderSelection(canvas.selectionPresence?.toJSON() ?? null);
```

Completed selections remain present after a move or transform commits, and
after deleting their texture pixels. A cleared selection reports `null`.
The older gesture events retain their existing behavior; `selection-idle`
means a gesture ended and does not imply that the selection was cleared.

### Pixel accuracy

Reading is exact wherever the platform allows it: `@jolly-pixel/image/browser` tries WebCodecs `ImageDecoder` first, then its own PNG decoder, and only then a canvas, whose premultiplied backing store cannot reproduce RGB under a low alpha. See [the ladder](https://github.com/JollyPixel/editor/blob/main/packages/image/docs/raster.md). `decodeRasterBlob()` is exported and shares this path, in the `RGBA8[]` shape the clipboard uses.

Writing is exact unconditionally. A copy's `image/png` flavor is built by `encodePng` from the snapshot's own bytes, so no canvas is involved and low-alpha pixels reach other applications intact. Masked-out pixels keep their RGB and take alpha 0.

### Errors

OS clipboard access normally requires HTTPS, localhost or Electron. When reading is unavailable or denied, paste uses the internal snapshot. A readable clipboard with no raster image does not reuse stale internal data. If placing a decoded selection fails, the canvas reports `paste-failed`, restores the previous mode, and leaves no partial selection behind. Results are structured and also sent to `onClipboardResult`.

## History

### `undo()` / `redo()` / `canUndo()` / `canRedo()`

```ts
undo(): boolean
redo(): boolean
canUndo(): boolean
canRedo(): boolean
```

History must be enabled through [`PixelArtCanvasOptions.history`](./PixelArtCanvasOptions.md#history). `undo` and `redo` replay the newest step that is not refused in the canvas's scope and return whether one did; `canUndo` and `canRedo` leave refused steps out.

### `history` / `historyScope`

```ts
get history(): CommandHistory<string> | null
get historyScope(): string
```

The history the canvas records into, `null` when disabled, and its scope: `"pixels"` for a standalone history, the owner's scope otherwise.

### `undoDepth()` / `redoDepth()`

```ts
undoDepth(): number
redoDepth(): number
```

The number of steps that can be undone or redone, refused steps left out. Both are `0` when history is disabled.

A peer edit, a remote resize or texture replacement, or a snapshot load refuses the steps whose values it changed. See [pixel history](./history/PixelHistory.md).

## View and canvas elements

```ts
get backgroundColor(): string
set backgroundColor(value: ColorInput)

get camera(): Vec2
get zoom(): Zoom

centerTexture(): void
canvas(): HTMLCanvasElement
textureCanvas(): HTMLCanvasElement
```

### `backgroundColor`

Controls the area outside the texture and redraws the visible canvas when changed.

### `camera` / `zoom`

Convenience accessors for `viewport.camera` and `viewport.zoom`. `camera` returns a copy; `zoom` returns the same `Zoom` instance as the viewport. `zoom.value` is the displayed zoom and `zoom.target` the level it eases toward; they are equal at rest.

### `centerTexture()`

Frames the texture in the current viewport, one axis at a time. An axis where the texture fits with 8px of padding on each side is centered; otherwise the texture is anchored 8px from the top or left edge.

### `canvas()` / `textureCanvas()`

`canvas()` returns the visible canvas. `textureCanvas()` returns the off-screen canvas containing the current texture. Direct writes to the texture canvas bypass history and commands.

## DOM lifecycle

```ts
get parentHtmlElement(): HTMLDivElement
reparentCanvasTo(parent: HTMLDivElement): void
onResize(): void
destroy(): void
```

### `parentHtmlElement` / `reparentCanvasTo()`

Reads or changes the element containing the visible canvas and overlays. Reparenting also updates their dimensions.

### `onResize()`

Resizes the canvas and overlays to the current parent bounds. It does nothing when either parent dimension is zero. Call it when the containing layout changes. On each axis, the camera moves by half the size change when the texture fits before and after, and stays put when it overflows both times. An axis where the texture starts or stops fitting is framed again as `centerTexture()` would, and so is the first sizing of a canvas created hidden. Resizing the texture itself follows the same rules.

### `destroy()`

Removes input listeners and unmounts the canvas and overlays.

## Network integration

`PixelArtCanvas` exposes presence callbacks and peer overlays used by the multiplayer helpers. Commands, remote commands, snapshots and `runLocalRestore` belong to [`document`](./PixelDocument.md#remote-state).

```ts
onCursorMove?: (position: Vec2 | null) => void;
onStrokeProgress?: (pixels: PeerStrokePixel[]) => void;
```

`onCursorMove` receives the texture position under the pointer, or `null` off the texture. `onStrokeProgress` receives the pixels of the stroke or line preview in progress: every pixel so far in one color, as a new array on each call, then an empty array when the stroke ends or the line is drawn or cancelled.
