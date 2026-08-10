# PixelArtCanvasOptions

Configures a [`PixelArtCanvas`](./PixelArtCanvas.md) when it is constructed.

```ts
import type {
  PixelArtCanvasOptions,
  WindowLike
} from "@jolly-pixel/pixel-draw.renderer";

const options: PixelArtCanvasOptions = {
  defaultMode: "paint",
  texture: { size: { x: 64, y: 32 } },
  history: { enabled: true, limit: 20 }
};

const canvas = new PixelArtCanvas(parent, options);
```

## Types

The nested interfaces below are shown for readability; they are fields of `PixelArtCanvasOptions`.

```ts
interface PixelArtCanvasOptions {
  defaultMode?: Mode;
  window?: WindowLike;
  texture?: TextureOptions;
  zoom?: ZoomOptions;
  backgroundTransparency?: BackgroundTransparencyOptions;
  backgroundColor?: ColorInput;
  brush?: BrushOptions;
  select?: SelectOptions;
  onDrawEnd?: () => void;
  onBufferUpdated?: PixelBufferHookListener;
  history?: HistoryOptions;
  onHistoryChange?: (state: HistoryState) => void;
  clipboard?: ClipboardAdapter | null;
  onClipboardResult?: (result: ClipboardOperationResult) => void;
  onModeChange?: (mode: Mode, previousMode: Mode) => void;
  keybindings?: Partial<KeybindingsMap>;
}

interface TextureOptions {
  defaultColor?: ColorInput;
  size?: { x: number; y?: number; };
  maxSize?: number;
  init?: HTMLCanvasElement;
}

interface BackgroundTransparencyOptions {
  colors: { odd: string; even: string; };
  squareSize: number;
}

interface SelectOptions {
  eraseColor?: ColorInput;
}

interface HistoryOptions {
  enabled?: boolean;
  limit?: number;
}

interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

type ColorInput = string | Color;
```

`Color` is the [colorjs.io](https://colorjs.io) class.

## Interaction

### `defaultMode`

Initial interaction mode. It accepts `"paint"`, `"move"`, `"fill"`, `"select"` or `"uv"` and defaults to `"paint"`. See [`PixelArtCanvas.mode`](./PixelArtCanvas.md#mode).

### `keybindings`

Overrides selected keyboard shortcuts. Unspecified actions keep their defaults. See [`Keybindings`](./input/Keybindings.md).

### `window`

Event target used for drag continuation, keyboard input and blur handling. It defaults to the global `window` and accepts an object with compatible `addEventListener()` and `removeEventListener()` methods.

`WindowLike` is exported for typed browser adapters and test doubles.

### `clipboard`

Overrides `navigator.clipboard` with an adapter exposing compatible `read()` and `write()` methods. Omit it to use the Async Clipboard API when available. Pass `null` to force internal-only copy and paste.

### `onClipboardResult`

Receives every copy or paste result, including toolbar, keyboard and direct API calls. Codes cover success, internal-only copy, busy operations, denied access, missing or invalid images, transparent images, maximum-size rejection, and a decoded selection that could not be placed (`paste-failed`).

### `onModeChange`

Called after an explicit mode change and after a successful paste switches the canvas to Select mode. It receives the new and previous modes.

## Texture

### `texture.size`

Initial texture size. `y` defaults to `x`; the full default is `{ x: 64, y: 32 }`.

### `texture.defaultColor`

Initial texture color. It defaults to opaque white.

### `texture.maxSize`

Maximum texture dimension. Retained master storage grows toward this limit only as larger texture dimensions are reached. It must be a positive integer and defaults to `2048`.

### `texture.init`

Initial texture canvas. Its pixel data and dimensions replace the freshly created texture.

## View

### `zoom`

```ts
interface ZoomOptions {
  default?: number;
  min?: number;
  max?: number;
  sensitivity?: number;
}
```

The default zoom fits the texture inside the parent with a small margin. It falls back to `4` when the parent has no size. `min`, `max` and `sensitivity` default to `1`, `32` and `0.1`.

### `backgroundTransparency`

Sets the checkerboard colors and square size behind transparent pixels. Omit it to use `{ odd: "#999", even: "#666" }` with `8`-pixel squares.

### `backgroundColor`

Sets the canvas area outside the texture. When omitted, the canvas uses the parent's non-transparent computed background color or `"#424242"`.

## Drawing and selection

### `brush`

Initial brush colors, size and highlight colors. See [`BrushOptions`](./tools/Brush.md#types).

### `select.eraseColor`

Color used for pixels vacated by selection deletion, movement or transforms. When omitted, the canvas uses the dominant neighboring color and falls back to transparency when no in-bounds neighbor exists.

## History

### `history`

History is disabled by default. Set `enabled` to `true` to record local edits. `limit` defaults to `10` and caps the undo stack.

### `onHistoryChange`

Called after the history stack is pushed, undone, redone or cleared. The callback receives `canUndo` and `canRedo`.

## Edit callbacks

### `onDrawEnd`

Called after a stroke, global fill or selection edit is applied. It also runs after equivalent remote edits and successful undo or redo. Resizing, texture replacement and UV changes do not call it directly.

### `onBufferUpdated`

Receives local pixel and UV mutation commands, including undo and redo replay. Commands applied through the remote API do not fire it again. See [`PixelArtCanvas` network integration](./network/api/CanvasIntegration.md#onbufferupdated).
