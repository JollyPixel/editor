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
type Mode = "paint" | "move" | "fill" | "select" | "uv";
```

## Core objects

```ts
readonly brush: Brush
readonly tools: Toolset
readonly uv: UVMap
readonly viewport: DefaultViewport
```

### `brush`

Stores the primary and secondary colors, opacity, brush size and cursor colors. See [`Brush`](./tools/Brush.md).

### `tools`

Runtime controls for color picking, fill behavior and selection transforms. See [`Toolset`](./tools/Toolset.md).

### `uv`

Creates, moves and selects texture regions. See [`UVMap`](./uv/UVMap.md).

### `viewport`

Read-only camera and zoom state:

```ts
interface DefaultViewport {
  readonly camera: Readonly<Vec2>;
  readonly zoom: Zoom;
}
```

## Interaction

### `mode`

```ts
get mode(): Mode
set mode(value: Mode)
```

| Mode | Left-click | Right-click |
|---|---|---|
| `"paint"` | Paint with `brush.primary`. Hold `Shift` for a straight line. When the picker is armed, pick into `brush.primary`. | Paint with `brush.secondary`. When the picker is armed, pick into `brush.secondary`; otherwise `Ctrl`+right-click picks into `brush.primary`. |
| `"move"` | Pan the view. | No action. |
| `"fill"` | Fill with `brush.primary`. | Fill with `brush.secondary`. |
| `"select"` | Create or move a selection. | No action. |
| `"uv"` | Select or drag a visible UV region. | No action. |

Wheel input zooms in every mode. Middle-drag or `Space`+left-drag pans the view. In paint mode, `Ctrl`+wheel changes `brush.size` by one pixel per scroll direction.

Leaving paint mode cancels an armed line and color pick. Leaving select mode clears the selection. Leaving UV mode cancels the current drag and keeps the UV selection.

### `keybindings`

```ts
get keybindings(): Keybindings
```

Use `keybindings.bindings` to read the current bindings and `keybindings.patch()` to change them. Invalid or conflicting patches throw without changing the previous bindings. See [`Keybindings`](./input/Keybindings.md).

## Texture

```ts
get textureSize(): Vec2
get maxTextureSize(): number
set textureSize(value: Vec2)

get texture(): Uint8ClampedArray
set texture(source: HTMLCanvasElement | HTMLImageElement)

commitPixels(
  pixels: Vec2[],
  slot?: "primary" | "secondary"
): void

hasTransparency(rect: SelectionRect): boolean
```

### `textureSize`

Gets or resizes the texture. Shrinking hides committed pixels outside the new bounds; growing can restore pixels retained by the master buffer. Dimensions must be positive integers no greater than [`texture.maxSize`](./PixelArtCanvasOptions.md#texturemaxsize).

`maxTextureSize` exposes that validated limit for import UIs.

### `texture`

The getter returns a copy of the current RGBA pixel data. The setter replaces the texture and resizes it to the source image or canvas.

### `commitPixels()`

Paints a precomputed set of texture coordinates as one edit. The color slot defaults to `"primary"`; an empty array does nothing.

### `hasTransparency()`

Returns `true` when any pixel in `rect` has alpha below `255`. Areas outside the texture count as transparent.

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

### Pixel accuracy

External images are decoded through WebCodecs `ImageDecoder` when available, which yields the file's own unpremultiplied samples with no color-profile transform applied. Without it, decoding falls back to `createImageBitmap` with `premultiplyAlpha` and `colorSpaceConversion` set to `"none"`, then to an `<img>`; both go through a canvas, whose premultiplied backing store cannot reproduce RGB under a low alpha exactly. `decodeRasterBlob()` and `decodeRasterCanvas()` are exported and share this path.

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

History must be enabled through [`PixelArtCanvasOptions.history`](./PixelArtCanvasOptions.md#history). Each method returns whether the requested operation is available or succeeded.

A remote resize, remote texture replacement or snapshot load clears local history. See [`HistoryStack`](./history/HistoryStack.md) for recorded edit types and replay behavior.

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

Convenience accessors for `viewport.camera` and `viewport.zoom`. `camera` returns a copy; `zoom` returns the same `Zoom` instance as the viewport.

### `centerTexture()`

Centers the texture in the current viewport.

### `canvas()` / `textureCanvas()`

`canvas()` returns the visible canvas. `textureCanvas()` returns the off-screen canvas containing the current texture. Direct writes to the texture canvas bypass history and mutation hooks.

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

Resizes the canvas and overlays to the current parent bounds. It does nothing when either parent dimension is zero. Call it when the containing layout changes.

### `destroy()`

Removes input listeners and unmounts the canvas and overlays.

## Network integration

`PixelArtCanvas` also exposes mutation hooks, presence callbacks and peer overlays used by the multiplayer helpers. See [network integration](./network/api/CanvasIntegration.md) for those members and [network synchronization](./network/index.md) for setup.
