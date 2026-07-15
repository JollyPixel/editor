# README.md

<h1 align="center">
  pixel-draw.renderer
</h1>

<p align="center">
  JollyPixel Pixel Art canvas renderer
</p>

## About

`@jolly-pixel/pixel-draw.renderer` is a browser-based library for editing pixel-art textures. It provides zoom, pan, brush painting, right-click color picking, and an SVG cursor overlay, built around a SOLID-structured class architecture.

## Features

- **Zoom & pan** — smooth mouse-wheel zoom with configurable sensitivity and range; middle-click pan in any mode
- **Brush painting** — configurable square brush with adjustable size, color, and opacity
- **Flexible color input** — every color option accepts a CSS color string (hex, `rgb()`, `hsl()`, named color, ...) or a [colorjs.io](https://colorjs.io) `Color` instance
- **Color picking** — right-click eyedropper that reads the master canvas pixel
- **Transparency support** — configurable checkerboard background renders beneath transparent pixels
- **SVG brush highlight** — grid-aligned SVG overlay tracks the cursor in real time
- **Dual-canvas architecture** — a master canvas (full resolution, off-screen) and a working canvas (viewport-cropped, on-screen) maintain pixel-perfect fidelity at any zoom level
- **Mode switching** — `"paint"` and `"move"` modes control how mouse events are interpreted

## Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/pixel-draw.renderer
# or
$ yarn add @jolly-pixel/pixel-draw.renderer
```

## Usage Examples

### Minimal setup

```ts
import { CanvasManager } from "@jolly-pixel/pixel-draw.renderer";

const manager = new CanvasManager({
  texture: { size: 64 },
  zoom: {
    range: [0.5, 40],
    sensitivity: 0.002
  },
});

const container = document.getElementById("editor-container")!;
manager.reparentCanvasTo(container);
manager.resize();
manager.centerTexture();
```

### Drawing pixels programmatically

```ts
import { CanvasManager } from "@jolly-pixel/pixel-draw.renderer";

const manager = new CanvasManager({
  texture: { size: 32 }
});
manager.reparentCanvasTo(document.body);

// Draw a red pixel at texture position (10, 10)
manager.canvasBuffer.drawPixels(
  [{ x: 10, y: 10 }],
  { r: 255, g: 0, b: 0, a: 255 }
);
manager.render();
```

### Loading an existing texture

```ts
const img = new Image();
img.src = "/assets/sprite.png";
await img.decode();

manager.setTexture(img);
```

### Configuring the brush

```ts
manager.brush.setColor("#FF6600");
manager.brush.setOpacity(0.8);
manager.brush.setSize(3);
```

Color options accept a plain CSS string or a [colorjs.io](https://colorjs.io) `Color` instance:

```ts
import Color from "colorjs.io";

manager.brush.setColor(new Color("oklch(70% 0.15 50)"));
manager.brush.setColor("rebeccapurple");
```

### Switching modes

```ts
manager.setMode("move");  // left-click pans
manager.setMode("paint"); // left-click draws
```

## Running the Examples

```bash
npm run dev -w @jolly-pixel/pixel-draw.renderer
```

Open `http://localhost:5173` to see the interactive demo.

## API

| Class | Description |
|---|---|
| [`CanvasManager`](./docs/CanvasManager.md) | Top-level coordinator — the primary public API |
| [`Viewport`](./docs/Viewport.md) | Camera position, zoom level, and coordinate transforms |
| [`BrushManager`](./docs/BrushManager.md) | Brush size, color, opacity, and affected-pixel computation |
| `CanvasBuffer` | Dual-canvas pixel storage and image-data access |
| `CanvasRenderer` | Visible canvas drawing and checkerboard background |
| `InputController` | Mouse event routing to drawing and pan actions |
| `SvgManager` | SVG brush-highlight overlay |

## Troubleshooting

**Canvas is blank after mounting**
Call `manager.resize()` after `reparentCanvasTo()` to let the renderer read the parent element's dimensions, then call `manager.centerTexture()`.

**Pixels appear at the wrong position**
Pass `{ bounds: canvas.getBoundingClientRect() }` when calling `viewport.getMouseTexturePosition()`. Stale bounding rects cause offset errors.

**Master canvas is slow to initialize**
`CanvasBuffer` pre-allocates a canvas at `maxSize` (default `2048`). In test environments or when large textures are unnecessary, set `texture.maxSize` to a smaller value such as `64`.

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md


# BrushManager.md

# BrushManager

`BrushManager` manages the current brush color, opacity, size, and highlight colors, and computes the list of texture-space pixels a brush stroke covers.

## Types

```ts
new BrushManager(options: BrushManagerOptions)

export type ColorInput = string | Color; // Color is colorjs.io's Color class

export interface BrushManagerOptions {
  /**
   * Base color of the brush. Accepts a CSS color string (hex, rgb(), hsl(),
   * named color, ...) or a colorjs.io `Color` instance.
   * Opacity can be controlled separately with the `opacity` property.
   * @default "#000000"
   */
  color?: ColorInput;
  /**
   * Size of the brush in pixels. Must be a positive integer.
   * The actual affected area will be a square of `size x size` pixels centered around the target pixel.
   * @default 32
   */
  size?: number;
  /**
   * Maximum allowed size for the brush. This is used to constrain the `size` property.
   * Must be a positive integer. If `size` is set higher than `maxSize`, it will be clamped to `maxSize`.
   * @default 32
   */
  maxSize?: number;
  /**
   * Highlight colors for the brush preview.
   * These colors are used to render the brush outline and fill when hovering over the canvas.
   * @default { colorInline: "#FFF", colorOutline: "#000" }
   */
  highlight?: {
    colorInline?: ColorInput;
    colorOutline?: ColorInput;
  };
}
```

## Methods

### `setColor`

```ts
setColor(color: ColorInput, opacity?: number): void
```

Sets the brush color from a CSS color string (hex, rgb(), hsl(), named color, ...) or a colorjs.io `Color` instance. If `opacity` is omitted, the current opacity is preserved; otherwise it's clamped to `[0, 1]` and applied alongside the new color.

---

### `getColor`

```ts
getColor(format?: "rgba" | "hex"): string
```

Returns the current brush color. Defaults to an `rgba(r, g, b, a)` string; pass `"hex"` to get a 6-digit hex string instead (opacity is not represented in hex output).

---

### `setOpacity`

```ts
setOpacity(opacity: number): void
```

Sets the brush opacity. Values are clamped to `[0, 1]`.

---

### `setSize`

```ts
setSize(size: number): void
```

Sets the brush size in pixels. Values are clamped to `[1, maxSize]`.

---

### `getHighlightColorInline` / `setHighlightColorInline`

```ts
getHighlightColorInline(): string
setHighlightColorInline(color: ColorInput): void
```

Gets or sets the inner stroke color of the SVG brush cursor overlay.

---

### `getHighlightColorOutline` / `setHighlightColorOutline`

```ts
getHighlightColorOutline(): string
setHighlightColorOutline(color: ColorInput): void
```

Gets or sets the outer stroke color of the SVG brush cursor overlay.

---

### `getAffectedPixels`

```ts
getAffectedPixels(cx: number, cy: number): Vec2[]
```

Returns an array of texture-space `{ x, y }` coordinates for every pixel within the current brush square centered at `(cx, cy)`.

- For **odd** brush sizes the center pixel is exactly `(cx, cy)`.
- For **even** brush sizes the brush is offset by `−0.5` to remain grid-aligned.

**Example**

```ts
// size = 3 → 9 pixels around (10, 10)
const pixels = brush.getAffectedPixels(10, 10);
canvasBuffer.drawPixels(pixels, { r: 255, g: 0, b: 0, a: 255 });
```


# CanvasManager.md

# CanvasManager

`CanvasManager` is the top-level coordinator for the pixel-draw renderer. It wires together the [`Viewport`](./Viewport.md), `CanvasBuffer`, `CanvasRenderer`, `InputController`, and `SvgManager` into a single cohesive public API.

## Types

```ts
new CanvasManager(options?: CanvasManagerOptions)
```

### `CanvasManagerOptions`

| Property | Type | Default | Description |
|---|---|---|---|
| `texture.size` | `number` | `64` | Initial texture size in pixels (square) |
| `texture.defaultColor` | `ColorInput` | transparent black | Fill color used when the texture is cleared. Accepts a CSS color string or a colorjs.io `Color` instance |
| `texture.maxSize` | `number` | `2048` | Maximum texture size; the master canvas is pre-allocated at this size |
| `zoom.range` | `[min, max]` | `[0.5, 40]` | Minimum and maximum zoom multipliers |
| `zoom.sensitivity` | `number` | `0.002` | Wheel-delta multiplier for zoom speed |
| `background.size` | `number` | `8` | Checkerboard tile size in pixels |
| `background.color1` | `ColorInput` | `"#FFFFFF"` | First checkerboard color |
| `background.color2` | `ColorInput` | `"#CCCCCC"` | Second checkerboard color |
| `brush.color` | `ColorInput` | `"#000000"` | Initial brush color. Accepts a CSS color string or a colorjs.io `Color` instance |
| `brush.size` | `number` | `1` | Initial brush size in pixels |
| `brush.maxSize` | `number` | `32` | Maximum brush size |
| `onDrawEnd` | `() => void` | — | Called after a draw stroke is committed to the master buffer |
| `onBufferUpdated` | `PixelBufferHookListener` | — | Called for every local mutation (stroke, resize, texture replace); see [Network.md](./Network.md) |

`ColorInput` (`type ColorInput = string | Color`) is used throughout the package wherever a color option is accepted: a CSS color string (hex, `rgb()`, `hsl()`, named color, ...) or a [colorjs.io](https://colorjs.io) `Color` instance.

## Properties

### `brush`

```ts
readonly brush: BrushManager
```

The brush manager instance. Use it to read or change the current brush color, opacity, and size.

### `viewport`

```ts
readonly viewport: Viewport
```

The viewport instance. Use it to read zoom and camera position, or to call coordinate-conversion methods directly.

### `canvasBuffer`

```ts
readonly canvasBuffer: CanvasBuffer
```

Direct access to the dual-canvas pixel storage. Useful for programmatic pixel drawing outside of user input.

## Methods

### `getMode` / `setMode`

```ts
getMode(): Mode
setMode(mode: Mode): void
```

Returns or sets the current interaction mode. `"paint"` routes left-click events to brush drawing; `"move"` routes them to panning.

---

### `getSize` / `setSize`

```ts
getSize(): number
setSize(size: number): void
```

Returns or changes the current texture size. `setSize` copies the master canvas content at the new dimensions and resizes the working canvas.

---

### `setTexture`

```ts
setTexture(source: HTMLCanvasElement | HTMLImageElement): void
```

Replaces the texture with the pixel data from `img`. The image is drawn into the master canvas and the working canvas is resized to match.

---

### `getTexture`

```ts
getTexture(): HTMLImageElement
```

Returns an `HTMLImageElement` snapshot of the master canvas at the current texture size.

---

### `getCanvas`

```ts
getCanvas(): HTMLCanvasElement
```

Returns the visible (working) canvas element. Useful for attaching additional event listeners or overlays.

---

### `getCamera`

```ts
getCamera(): Vec2
```

Returns the current camera offset `{ x, y }` in viewport space.

---

### `getZoom`

```ts
getZoom(): number
```

Returns the current zoom multiplier.

---

### `centerTexture`

```ts
centerTexture(): void
```

Pans and positions the camera so the texture is centered in the current viewport.

---

### `reparentCanvasTo`

```ts
reparentCanvasTo(parent: HTMLElement): void
```

Moves the working canvas and the SVG overlay into `parent`. Call this when mounting the editor into a new DOM container.

---

### `resize`

```ts
resize(): void
```

Reads the current dimensions of the parent element and resizes the working canvas to fill it. Call this after the parent element changes size (e.g. on `window.resize`).

---

### `render`

```ts
render(): void
```

Forces an immediate redraw of the visible canvas from the current working texture.

---

### `destroy()`

Destroy the canvas and all related elements (listeners etc)

---

### `onBufferUpdated` / `applyRemoteCommand` / `loadSnapshot`

```ts
set onBufferUpdated(fn: PixelBufferHookListener | undefined)
applyRemoteCommand(event: PixelBufferHookEvent): void
loadSnapshot(size: Vec2, pixels: Uint8ClampedArray): void
```

Network sync hooks, used by `PixelSyncSession` — see [Network.md](./Network.md).
`onBufferUpdated` fires on every local mutation (stroke, resize, texture
replace). `applyRemoteCommand` applies a mutation from a remote peer without
re-firing `onBufferUpdated`. `loadSnapshot` hydrates the buffer from a network
snapshot; it is never itself broadcast.


# Network.md

# Network Sync Layer

Transport-agnostic, server-authoritative multiplayer for CanvasManager. Multiple
clients can share the same texture(s) in real time. Structurally mirrors
`@jolly-pixel/voxel.renderer`'s network layer but is an independent
implementation — this package has no dependency on voxel-renderer.

## Architecture

```
┌───────────────┐  onBufferUpdated   ┌──────────────────┐   sendCommand   ┌─────────────┐
│ CanvasManager │───────────────────▶│ PixelSyncSession │────────────────▶│  Transport  │
│  (per buffer) │                    │  (multi-buffer)  │◀────────────────│ (WebSocket, │
│               │◀──applyRemote──────│                  │   onCommand     │  WebRTC, …) │
└───────────────┘                    └──────────────────┘                 └──────┬──────┘
                                                                                  │ wire
                                                                                  ▼
                                                                       ┌──────────────────┐
                                                                       │  PixelSyncServer │
                                                                       │    (headless)    │
                                                                       │    PixelWorld    │
                                                                       └──────────────────┘
```

A `CanvasManager` has no concept of a buffer identity — it owns exactly one
texture. `PixelSyncSession` assigns that texture a `bufferId` and can attach
several `CanvasManager` instances to the same transport connection (e.g. one
per open tileset).

**Flow:**
1. A local mutation (a paint stroke, resize, or `setTexture`) fires
   `CanvasManager.onBufferUpdated`.
2. `PixelSyncSession` stamps the event with `bufferId / clientId / seq /
   timestamp` and calls `transport.sendCommand(cmd)`.
3. The transport delivers the command to `PixelSyncServer.receive()`.
4. The server resolves conflicts, applies the command to its authoritative
   `PixelWorld`, and broadcasts it to clients subscribed to that buffer.
5. Each subscribed client's transport calls `onCommand(cmd)`, which
   `PixelSyncSession` routes to the matching `CanvasManager.applyRemoteCommand()`.
6. `applyRemoteCommand` suppresses `onBufferUpdated` while applying, so the
   result is never re-broadcast — no echo loop.

Buffers are not sent in bulk. A client receives a buffer's pixel data only
when it subscribes to that specific `bufferId` (via `attach`/`createBuffer`).

## PixelTransport interface

```ts
interface PixelTransport {
  readonly localClientId: string;
  sendCommand(cmd: PixelNetworkCommand): void;
  subscribe(bufferId: string): void;
  unsubscribe(bufferId: string): void;
  onCommand: ((cmd: PixelNetworkCommand) => void) | null;
  onSnapshot: ((bufferId: string, snapshot: PixelBufferSnapshot) => void) | null;
  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}
```

### WebSocket example stub

```ts
import type {
  PixelTransport,
  PixelNetworkCommand,
  PixelBufferSnapshot
} from "@jolly-pixel/pixel-draw.renderer";

class WebSocketTransport implements PixelTransport {
  readonly localClientId = crypto.randomUUID();
  onCommand: ((cmd: PixelNetworkCommand) => void) | null = null;
  onSnapshot: ((bufferId: string, snapshot: PixelBufferSnapshot) => void) | null = null;
  onPeerJoined: ((peerId: string) => void) | null = null;
  onPeerLeft: ((peerId: string) => void) | null = null;

  constructor(private ws: WebSocket) {
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data as string);
      switch (msg.type) {
        case "snapshot": this.onSnapshot?.(msg.bufferId, msg.data); break;
        case "command": this.onCommand?.(msg.data); break;
        case "peer-joined": this.onPeerJoined?.(msg.peerId); break;
        case "peer-left": this.onPeerLeft?.(msg.peerId); break;
      }
    });
  }

  sendCommand(cmd: PixelNetworkCommand): void {
    this.ws.send(JSON.stringify({ type: "command", data: cmd }));
  }

  subscribe(bufferId: string): void {
    this.ws.send(JSON.stringify({ type: "subscribe", bufferId }));
  }

  unsubscribe(bufferId: string): void {
    this.ws.send(JSON.stringify({ type: "unsubscribe", bufferId }));
  }
}
```

## PixelSyncSession

```ts
import { fromUint8Array } from "js-base64";
import {
  PixelSyncSession
} from "@jolly-pixel/pixel-draw.renderer";

const session = new PixelSyncSession({ transport: myTransport });

// Attach an existing texture, assumed to already exist on the server.
// Subscribes and receives its snapshot asynchronously via onSnapshot.
session.attach("tileset-1", canvasManager);

// Attach AND announce a brand new buffer, seeding peers with its current pixels.
session.createBuffer("tileset-2", otherCanvasManager, {
  size: otherCanvasManager.getTextureSize(),
  pixels: fromUint8Array(new Uint8Array(otherCanvasManager.getTexture()))
});

session.onBufferAdded = (bufferId, metadata) => {
  // A peer created a new buffer this client hasn't attached to.
};
session.onBufferRemoved = (bufferId) => {
  // A peer removed a buffer.
};

// Stop syncing a texture (e.g. the user closed that tab).
session.detach("tileset-1");
// Same, but also tells peers the buffer is gone.
session.removeBuffer("tileset-2");

session.destroy();
```

One `PixelSyncSession` per transport connection. Each `CanvasManager` is
attached under exactly one `bufferId`.

## PixelSyncServer

Headless — no DOM/Canvas2D dependency. Runs in Node.js, Deno, or Bun.

```ts
import {
  PixelSyncServer,
  type ClientHandle
} from "@jolly-pixel/pixel-draw.renderer";
import { WebSocketServer } from "ws";

const server = new PixelSyncServer();
const wss = new WebSocketServer({ port: 3000 });

wss.on("connection", (ws) => {
  const client: ClientHandle = {
    id: crypto.randomUUID(),
    send: (data) => ws.send(JSON.stringify(data))
  };

  server.connect(client);

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    switch (msg.type) {
      case "command": server.receive(msg.data); break;
      case "subscribe": server.subscribe(client.id, msg.bufferId); break;
      case "unsubscribe": server.unsubscribe(client.id, msg.bufferId); break;
    }
  });

  ws.on("close", () => server.disconnect(client.id));
});
```

| Method | Description |
|---|---|
| `connect(client)` | Registers the client, notifies existing peers. Sends no buffer data. |
| `disconnect(clientId)` | Removes the client, notifies remaining peers. |
| `subscribe(clientId, bufferId)` | Subscribes the client to a buffer's updates and sends its current snapshot, if it exists. |
| `unsubscribe(clientId, bufferId)` | Stops broadcasting that buffer's updates to the client. |
| `receive(cmd)` | Validates, applies, and broadcasts a command to that buffer's subscribers. |
| `snapshot(bufferId)` | Returns the buffer's current state as `PixelBufferSnapshot`, or `undefined`. |
| `world` | The authoritative `PixelWorld` instance. |

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `world` | `PixelWorld` | new world | Existing world to use as authoritative state. |
| `conflictResolver` | `PixelConflictResolver` | `LastWriteWinsResolver` | Custom conflict strategy. |

## PixelNetworkCommand — wire format

```ts
type PixelNetworkCommand = (PixelBufferHookEvent | PixelLifecycleEvent) & {
  bufferId: string;
  clientId: string;
  seq: number;
  timestamp: number;
};
```

Five actions: `"buffer-added"`, `"buffer-removed"`, `"stroke"`, `"resized"`,
`"texture-replaced"`. All pixel payloads (`stroke` positions excepted) are
raw RGBA bytes, base64-encoded via `js-base64` — no image codec dependency, so
`PixelSyncServer` stays headless. Commands are plain JSON-serializable
objects.

A `"stroke"` command carries one color and a deduped list of pixel
positions for an entire paint stroke (mouse-down to mouse-up), not one
command per brush stamp.

## ConflictResolver

Conflicts are resolved **per pixel**, not per command — a single stroke
command can touch thousands of pixels, so a command is split: pixels that
lose the race are dropped from the applied/broadcast copy, the rest are
applied normally. `"buffer-added"`, `"buffer-removed"`, `"resized"`, and
`"texture-replaced"` are structural and always accepted.

### Default: LastWriteWinsResolver

Higher `timestamp` wins. On a tie, the lexicographically greater `clientId`
wins (deterministic without coordination).

```ts
import {
  LastWriteWinsResolver
} from "@jolly-pixel/pixel-draw.renderer";

const server = new PixelSyncServer({
  conflictResolver: new LastWriteWinsResolver() // default, no need to pass explicitly
});
```

### Custom resolver

```ts
import type {
  PixelConflictResolver,
  PixelConflictContext
} from "@jolly-pixel/pixel-draw.renderer";

class FirstWriteWinsResolver implements PixelConflictResolver {
  resolve({ existing }: PixelConflictContext): "accept" | "reject" {
    return existing ? "reject" : "accept";
  }
}

const server = new PixelSyncServer({ conflictResolver: new FirstWriteWinsResolver() });
```

## applyCommandToWorld — headless usage

Replays a command against a bare `PixelWorld`, without a `CanvasManager`.
Useful for server-side logic, unit tests, or offline editing tools.

```ts
import {
  PixelWorld,
  applyCommandToWorld
} from "@jolly-pixel/pixel-draw.renderer";

const world = new PixelWorld();
applyCommandToWorld(world, {
  action: "buffer-added",
  bufferId: "tileset-1",
  metadata: { size: { x: 64, y: 32 } },
  clientId: "seed",
  seq: 1,
  timestamp: Date.now()
});
```


# Viewport.md

# Viewport

`Viewport` encapsulates camera position, zoom level, canvas dimensions, and all coordinate-space conversions between canvas pixels and texture pixels.

## Types

```ts
new Viewport(options: ViewportOptions)

export interface ViewportOptions {
  /**
   * Size of the texture to display in the viewport.
   * This is used to calculate the camera bounds and the zoom level.
   */
  textureSize: Vec2;
  /**
   * Default zoom level.
   * Can be overridden by passing a texture with a different size than the default one.
   * @default 4
   */
  zoom?: number;
  /**
   * Minimum zoom level. Must be under the max zoom level.
   * @default 1
   */
  zoomMin?: number;
  /**
   * Maximum zoom level. Must be above the min zoom level.
   * @default 32
   */
  zoomMax?: number;
  /**
   * Sensitivity of zooming when using the mouse wheel. The higher, the faster the zoom changes.
   * If the zoom level is under 1, the sensitivity is divided by 10 to allow finer control.
   * @default 0.1
   */
  zoomSensitivity?: number;
}
```

## Methods

### `resizeCanvas`

```ts
resizeCanvas(width: number, height: number): void
```

Updates the canvas size while preserving the current camera position.
Shifts the camera by half the size delta so the same world point stays at the center of the screen.

---

### `applyZoom`

```ts
applyZoom(delta: number, originX: number, originY: number): void
```

Adjusts the zoom level by `delta` (wheel units × sensitivity), keeping the point at `(originX, originY)` in canvas space fixed on screen.

---

### `applyPan`

```ts
applyPan(dx: number, dy: number): void
```

Translates the camera by `(dx, dy)` pixels in canvas space.

---

### `setCanvasSize`

```ts
setCanvasSize(width: number, height: number): void
```

Updates the tracked canvas dimensions. Call this whenever the visible canvas is resized.

---

### `setTextureSize`

```ts
setTextureSize(size: number): void
```

Updates the tracked texture size used in UV and screen-rect computations.

---

### `center`

```ts
center(): void
```

Resets the camera so the texture is centered in the current canvas.

---

### `getMouseCanvasPosition`

```ts
getMouseCanvasPosition(mx: number, my: number): Vec2
```

Converts a raw mouse event position (relative to the page) to canvas-local coordinates by subtracting the canvas bounding-rect offset.

---

### `getMouseTexturePosition`

```ts
getMouseTexturePosition(
  mx: number,
  my: number,
  opts: { bounds: DOMRect; limit?: boolean }
): Vec2
```

Converts a mouse position to texture-space pixel coordinates at the current zoom and camera offset.

- `bounds` — the canvas `DOMRect` obtained from `canvas.getBoundingClientRect()`
- `limit` — when `true`, clamps the result to `[0, textureSize - 1]`

**Example**

```ts
canvas.addEventListener("mousemove", (e) => {
  const bounds = canvas.getBoundingClientRect();
  const pos = viewport.getMouseTexturePosition(e.clientX, e.clientY, { bounds, limit: true });
  console.log(pos.x, pos.y); // texture-space coordinates
});
```

---

### `getTextureScreenRect`

```ts
getTextureScreenRect(): { x: number; y: number; width: number; height: number }
```

Returns the screen-space rectangle occupied by the texture at the current zoom and camera position. Useful for rendering the checkerboard background clip region or positioning DOM overlays.


