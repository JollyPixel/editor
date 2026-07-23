# README.md

<h1 align="center">
  pixel-draw.renderer
</h1>

<p align="center">
  JollyPixel Pixel Art canvas renderer
</p>

## 📌 About

Browser-based library for editing pixel-art textures: brush, fill, select, and UV region tools, undo/redo, zoom/pan, and optional real-time multiplayer sync, all behind a single `PixelArtCanvas` API.

## 💡 Features

- **Brush painting**: adjustable size, opacity, and primary/secondary color (CSS string or a [colorjs.io][colorjs] `Color` instance)
- **Paint-bucket fill**: flood-fill a connected region of same-colored pixels
- **Rectangle select**: drag to select a region
- **UV regions**: create/move/delete rectangular UV regions independently of painting, via the `uv` value object;
- **Undo/redo**: optional bounded history over strokes, resizes, texture replaces, and UV region changes;
- **Zoom & pan**: mouse-wheel and trackpad-pinch zoom with configurable sensitivity and range;
- **Transparency support**: checkerboard background renders beneath transparent pixels
- **Network sync**: transport-agnostic, server-authoritative multiplayer. Multiple clients can paint the same texture in real time

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/pixel-draw.renderer
# or
$ yarn add @jolly-pixel/pixel-draw.renderer
```

## 👀 Usage Example

```ts
import {
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

const container = document.getElementById("editor-container")!;
const manager = new PixelArtCanvas(container, {
  texture: {
    size: { x: 64, y: 64 }
  },
  defaultMode: "paint",
  backgroundColor: "#263238",
  zoom: {
    // No `default`: computed to fit the whole texture inside `container`.
    min: 1,
    max: 32
  },
  brush: {
    size: 3
  },
  history: {
    enabled: true
  }
});

manager.onResize();
manager.centerTexture();

manager.brush.primary.set("#FF6600", 0.8);
manager.brush.secondary.set("#3366FF");
manager.mode = "fill";
```

Loading an existing texture:

```ts
const img = new Image();
img.src = "/assets/sprite.png";
await img.decode();
manager.texture = img;
```

> See [`examples/`](./examples) for a full demo (a Lit-based toolbar panel driving `PixelArtCanvas` and painting a live Three.js texture).

### Modes

`mode` selects how left-click/drag is interpreted.

- `"paint"`: draw with the brush
- `"move"`: pan the camera
- `"fill"`: flood-fill the clicked region
- `"select"`: select, move, copy, and delete a rectangular region
- `"uv"`: select and drag UV regions; regions are created programmatically via `manager.uv.create(...)`, not by clicking

Panning and zooming (mouse wheel, trackpad pinch/drag) work from any mode, regardless of the current `mode`.

> [!TIP]
> Read [PixelArtCanvas.md](./docs/PixelArtCanvas.md#mode) for the full behavior, and the [Keybinds](#keybinds) section below for exact shortcuts.

### Keybinds

`Shift` (line draw) and `Space` (pan) are not **configurable** but everything below is:

| Action | Default |
|---|---|
| Copy | `Ctrl`/`Cmd`+`C` |
| Paste | `Ctrl`/`Cmd`+`V` |
| Undo | `Ctrl`/`Cmd`+`Z` |
| Redo | `Ctrl`/`Cmd`+`Y` or `Ctrl`/`Cmd`+`Shift`+`Z` |
| Delete | `Delete` |
| Rotate selection | `R` |
| Flip selection horizontal | `H` |
| Flip selection vertical | `V` |

Override at construction, or live via `keybindings.patch()`:

```ts
const manager = new PixelArtCanvas(container, {
  keybindings: {
    undo: "alt+u"
  } // unspecified actions keep their default
});

manager.keybindings.patch({
  redo: "alt+shift+u"
});
```

> [!TIP]
> Read [input/Keybindings.md](./docs/input/Keybindings.md) for the combo string format and error handling.

### Undo/redo

Disabled by default. Enable it and (optionally) track button-enabled state:

```ts
const manager = new PixelArtCanvas(container, {
  history: {
    enabled: true,
    // limit defaults to 10
    limit: 20
  },
  onHistoryChange: ({ canUndo, canRedo }) => {
    undoButton.disabled = !canUndo;
    redoButton.disabled = !canRedo;
  }
});

manager.undo(); // false if history is disabled or there's nothing to undo
manager.redo();
```

> [!TIP]
> Read [PixelArtCanvas.md](./docs/PixelArtCanvas.md#undo--redo--canundo--canredo) and [history/HistoryStack.md](./docs/history/HistoryStack.md).

## 🚀 Running the example

```bash
npm run dev -w @jolly-pixel/pixel-draw.renderer
```

Open `http://localhost:5173` to see the interactive demo.

## 📚 API

- [`PixelArtCanvas`](./docs/PixelArtCanvas.md)
  - [`Brush`](./docs/tools/Brush.md)
  - [`BrushTool`](./docs/tools/BrushTool.md)
  - [`FillTool`](./docs/tools/FillTool.md)
  - [`SelectTool`](./docs/tools/SelectTool.md)
- [`PixelBuffer`](./docs/buffer/PixelBuffer.md)
- [`Keybindings`](./docs/input/Keybindings.md)
- [`Network`](./docs/network/index.md)

### Advanced / Internal

Useful, but generally more internal-facing APIs:

- [`UVMap`](./docs/uv/UVMap.md)
- [`HistoryStack`](./docs/history/HistoryStack.md)

## 🧩 Types

Shared value types used across the public API:

```ts
type Vec2 = {
  x: number;
  y: number;
};

type Mode = "paint" | "move" | "fill" | "select" | "uv";

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RGBA { r: number; g: number; b: number; a: number; }
```

`Vec2` is a texture- or canvas-space coordinate depending on context. `SelectionRect` is always texture-space, used by `PixelBuffer.drawRegion` and the built-in select tool. Color options also accept `ColorInput` (`string | Color`, [colorjs.io][colorjs]'s class) — a CSS color string or a `Color` instance — but that alias isn't itself exported by name.

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
[colorjs]: https://colorjs.io


# PixelBuffer.md

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

### UV Regions

```ts
readonly uvRegions: UVRegionCollection
```

Server-side UV region storage for this buffer. Included in [`PixelSyncServer.snapshot()`](../network/PixelSyncServer.md#snapshot) so late-joining clients receive existing regions.

`UVRegionCollection` is an id-keyed map of `UVRegion`s. Entries are always keyed by `region.id` and stored as copies.

```ts
uvRegions.get(id: string): UVRegion | undefined
uvRegions.set(region: UVRegion): void   // upserts a copy by region.id
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
| `"uv-region-created"` | `region` (full) | |
| `"uv-region-deleted"` | `id` | |
| `"uv-region-moved"` | `id`, `rect` | |

All events carry an optional `originTimestamp`, set only during `undo()`/`redo()` replay so the network conflict policy (see [PixelSyncServer](../network/PixelSyncServer.md#conflict-policy-minimal)) re-races the edit at its original time instead of treating it as new.

> [!NOTE]
> `"global-fill"` bypasses per-pixel conflict resolution. Undoing it locally replays as a full-position `"stroke"` since exact undo requires knowing which pixels were touched.



# HistoryStack.md

# HistoryStack

Bounded undo/redo stack for `PixelArtCanvas`. Most consumers use `PixelArtCanvas.undo()`/`redo()` rather than this class directly. See [PixelArtCanvas.md](../PixelArtCanvas.md#undo--redo--canundo--canredo).

```ts
new HistoryStack(buffer: DefaultPixelBuffer, uvMap: UVMap, options?: HistoryStackOptions)
```

```ts
interface HistoryStackOptions {
  /** @default 10 */
  limit?: number;
}
```

`limit` caps the undo stack; pushing past it drops the oldest entry.

## Entry actions

| Action | What it records |
|---|---|
| `"stroke"` | `beforeColors` per-position, `afterColor` single color |
| `"resized"` / `"texture-replaced"` | Whole-buffer `beforePixels` / `afterPixels` snapshot |
| `"select-edit"` | `beforeColors`/`afterColors` per-position + `oldRect`/`newRect`/`oldMask`/`newMask` for selection state |
| `"uv-create"` / `"uv-delete"` | Full `region` (undo calls the inverse `UVMap` method) |
| `"uv-move"` | `oldRect` / `newRect` |

> [!NOTE]
> `"select-edit"` and `"uv-*"` undo/redo are broadcast over the network. See [uv/UVMap.md](../uv/UVMap.md#history--network).

## API

### `canUndo` / `canRedo`

```ts
get canUndo(): boolean
get canRedo(): boolean
```

### `push(entry)`

```ts
push(entry: HistoryEntryInput): void
```

Stamps `Date.now()` and pushes onto the undo stack, clearing redo. Drops the oldest entry when `limit` is exceeded.

### `undo()`

```ts
undo(): HistoryEntry | null
```

Reverts the most recent entry and moves it to the redo stack. Returns `null` if nothing to undo.

### `redo()`

```ts
redo(): HistoryEntry | null
```

Re-applies the most recently undone entry and moves it back to the undo stack. Returns `null` if nothing to redo.

### `clear()`

```ts
clear(): void
```

Discards both stacks. Call when the buffer is replaced from outside (e.g. remote resize or snapshot); `PixelArtCanvas` does this automatically.


# Keybindings.md

# Keybindings

Configurable keyboard shortcuts for `PixelArtCanvas`. See [PixelArtCanvas.md](../PixelArtCanvas.md#keybindings).

```ts
new Keybindings(patch?: Partial<KeybindingsMap>)
```

`patch` is merged onto `DEFAULT_KEYBINDINGS`; omitted actions keep their defaults.

## Keybinding format

A combo string of `+`-separated modifiers followed by a key: `"mod+z"`, `"mod+shift+z"`, `"Delete"`.

- `mod`: Ctrl on Windows/Linux, Cmd on macOS
- Key is matched against `KeyboardEvent.key` (case-insensitive)
- Modifier matching is exact: `"mod+c"` does **not** match Ctrl+Shift+C

```ts
type ModifierToken = "mod" | "shift" | "alt";
type Keybinding =
  | KeyToken
  | `${ModifierToken}+${KeyToken}`
  | `${ModifierToken}+${ModifierToken}+${KeyToken}`
  | `${ModifierToken}+${ModifierToken}+${ModifierToken}+${KeyToken}`;
type KeybindingsMap = Record<KeybindingAction, Keybinding | Keybinding[]>;
```

## Defaults

| Action | Default |
|---|---|
| Copy | `Ctrl`/`Cmd`+`C` |
| Paste | `Ctrl`/`Cmd`+`V` |
| Undo | `Ctrl`/`Cmd`+`Z` |
| Redo | `Ctrl`/`Cmd`+`Y` or `Ctrl`/`Cmd`+`Shift`+`Z` |
| Delete | `Delete` |
| Rotate selection | `R` |
| Flip selection horizontal | `H` |
| Flip selection vertical | `V` |

> [!IMPORTANT]
> `rotate`, `flipHorizontal`, `flipVertical` only apply in `"select"` mode with an active selection. Any action can be given an array of bindings.

## API

### `bindings`

```ts
get bindings(): Readonly<KeybindingsMap>
```

### `patch(patch)`

```ts
patch(patch: Partial<KeybindingsMap>): void
```

Merges onto current bindings. Throws on conflict or bad format; previous bindings stay in effect.

### `match(event)`

```ts
match(event: KeyboardEvent): KeybindingAction | null
```

Returns the matching action, or `null`.

## Errors

| Error | When |
|---|---|
| `InvalidKeybindingError` | Malformed combo string (bad modifier, empty segment) |
| `KeybindingConflictError` | Two actions resolve to the same combo |

Both throw synchronously from the constructor and `patch()`.


# index.md

# Network Sync

Multiplayer sync for one `PixelArtCanvas` per session, with server-authoritative state.

## Read This First

1. One `PixelSyncServer` owns one `PixelBuffer`.
2. One `PixelSyncSession` owns one `PixelArtCanvas`.
3. One namespace maps to one shared buffer.

If you sync 3 canvases, run 3 namespaces.

## 60-Second Setup

### Server

```ts
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";
import {
  PixelBuffer,
  PixelSyncServer
} from "@jolly-pixel/pixel-draw.renderer";

export default defineConfig({
   plugins: [
      createWebSocketNetworkPlugin({
         plugins: [
            new PixelSyncServer({
               namespace: "pixel-draw:main",
               buffer: new PixelBuffer({
                size: { x: 80, y: 80 }
              })
            })
         ]
      })
   ]
});
```

### Client

```ts
import { NetworkClient } from "@jolly-pixel/network";
import {
   PixelSyncSession,
   type PixelNetworkCommand,
   type PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const client = new NetworkClient({
  url: `${wsProtocol}//${location.host}/ws-sync`
});
const transport = client.channel<PixelNetworkCommand, PixelServerMessage>(
   "pixel-draw:main"
);

const session = new PixelSyncSession({ transport });
session.attach(canvas);
```

## How It Behaves

1. Local edits on the canvas emit buffer events.
2. `PixelSyncSession` stamps `clientId`, `seq`, and `timestamp` and sends.
3. `PixelSyncServer` validates, resolves conflicts, applies, then broadcasts.
4. Clients apply remote commands without re-broadcasting, so no echo loop.

On connect, the server immediately sends a snapshot so late joiners catch up.

## What To Read Next

| File | Use it when |
|---|---|
| [PixelSyncSession](./PixelSyncSession.md) | You are wiring client lifecycle (`attach`/`detach`/`destroy`) |
| [PixelSyncServer](./PixelSyncServer.md) | You are wiring server namespaces and authoritative buffers |


# PixelSyncServer.md

# PixelSyncServer

Authoritative server for pixel sync.

One instance manages one shared `PixelBuffer` under one namespace.

```ts
import { defineConfig } from "vite";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/plugins/vite.ts";
import {
  PixelBuffer,
  PixelSyncServer
} from "@jolly-pixel/pixel-draw.renderer";

const mainTexture = new PixelSyncServer({
  namespace: "pixel-draw:main",
  buffer: new PixelBuffer({
    size: { x: 80, y: 80 }
  })
});

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      plugins: [mainTexture]
    })
  ]
});
```

## Important Rules

1. Do not reuse a namespace across different buffers.
2. Pre-size the server buffer to match expected client startup state.
3. Register one `PixelSyncServer` per collaborative canvas.

## What It Handles

1. Sends a snapshot immediately when a client joins.
2. Accepts incoming commands.
3. Resolves conflicts.
4. Applies accepted commands to authoritative buffer.
5. Broadcasts accepted commands to clients in the same namespace.

## Constructor Options

```ts
new PixelSyncServer(options?: PixelSyncServerOptions)

interface PixelSyncServerOptions {
  namespace?: string; // default: "pixel-draw"
  buffer?: PixelBuffer; // default: blank 1x1
  conflictResolver?: PixelConflictResolver; // default: LastWriteWinsResolver
}

interface PixelBufferSnapshot {
  size: Vec2;
  pixels: string; // base64 RGBA
  uvRegions: UVRegion[];
}

type PixelServerMessage =
  | { type: "snapshot"; data: PixelBufferSnapshot; }
  | { type: "command"; data: PixelNetworkCommand; };
```

## Conflict Policy (Minimal)

By default, `PixelSyncServer` uses `LastWriteWinsResolver`.

What that means:
1. `stroke` and `select-edit` conflicts resolve per pixel.
2. `uv-region-moved` and `uv-region-deleted` conflicts resolve per region id.
3. `resized`, `texture-replaced`, `global-fill`, and `uv-region-created` are always accepted.
4. For the same key, same-client commands are accepted in send order; otherwise newer `timestamp` wins (and `clientId` breaks ties).

You can override this with `conflictResolver` in `PixelSyncServerOptions` when you need custom behavior.

## API You Might Actually Use

- `server.namespace`: namespace key.
- `server.buffer`: authoritative buffer.
- `server.receive(cmd)`: useful in tests and replay tools.
- `server.snapshot()`: exports current `PixelBufferSnapshot`.

`attach`, `onClientConnect`, `onClientDisconnect`, and `onMessage` are `NetworkPlugin` lifecycle hooks invoked by `@jolly-pixel/network`.

## Multi-Buffer Example

```ts
createWebSocketNetworkPlugin({
  plugins: [
    new PixelSyncServer({
      namespace: "pixel-draw:characters",
      buffer: new PixelBuffer({ size: { x: 32, y: 32 } })
    }),
    new PixelSyncServer({
      namespace: "pixel-draw:tiles",
      buffer: new PixelBuffer({ size: { x: 128, y: 128 } })
    })
  ]
});
```


# PixelSyncSession.md

# PixelSyncSession

Client-side sync controller.

It connects one `PixelArtCanvas` to one transport channel.

## Transport Shape

Use a namespace-scoped channel with this shape:

```ts
interface PixelTransport {
	readonly localClientId: string;
	send(command: PixelNetworkCommand): void;
	onMessage: ((message: PixelServerMessage) => void) | null;
	onPeerJoined: ((peerId: string) => void) | null;
	onPeerLeft: ((peerId: string) => void) | null;
}

interface PixelNetworkCommandHeader {
	clientId: string;
	seq: number;
	timestamp: number;
}

type PixelNetworkCommand = PixelBufferHookEvent & PixelNetworkCommandHeader;

interface PixelBufferSnapshot {
	size: Vec2;
	pixels: string; // base64 RGBA
	uvRegions: UVRegion[];
}

type PixelServerMessage =
	| { type: "snapshot"; data: PixelBufferSnapshot; }
	| { type: "command"; data: PixelNetworkCommand; };
```

`PixelNetworkCommand` actions come from `PixelBufferHookEvent` (`stroke`, `resized`, `texture-replaced`, `global-fill`, `select-edit`, and `uv-region-*`).

## Types Used By Session

```ts
new PixelSyncSession(options: PixelSyncSessionOptions)

interface PixelSyncSessionOptions {
	transport: PixelTransport;
}

interface PixelNetworkCommandHeader {
	clientId: string;
	seq: number;
	timestamp: number;
}
```

`PixelSyncSession` stamps local buffer events with these header fields before sending.

## Recommended Transport

Use `NetworkClient.channel()` from `@jolly-pixel/network` directly.

```ts
import { NetworkClient } from "@jolly-pixel/network";
import type {
	PixelNetworkCommand,
	PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const client = new NetworkClient({ url: `${wsProtocol}//${location.host}/ws-sync` });
const transport = client.channel<PixelNetworkCommand, PixelServerMessage>(
	"pixel-draw:main"
);
```

No adapter required.

## Use It Like This

```ts
import {
  PixelSyncSession
} from "@jolly-pixel/pixel-draw.renderer";

const session = new PixelSyncSession({ transport });
session.attach(canvas);

// Later
session.destroy();
```

## What It Does

1. Watches local canvas edits and sends them.
2. Applies server snapshot on connect.
3. Applies remote commands from peers.
4. Ignores your own echoed commands.

## Lifecycle

### `attach(canvas)`

- Attaches exactly one canvas.
- Throws if you call `attach` twice without `detach`.
- Chains onto the current `canvas.onBufferUpdated` handler instead of replacing it.

### `detach()`

- Stops sync for the attached canvas.
- Restores the previous `onBufferUpdated` handler.
- Safe to call when nothing is attached.

### `destroy()`

- Calls `detach()`.
- Clears `transport.onMessage`.
- Use this when the view/tab/session is done.

## Common Mistakes

1. Reusing one session for multiple canvases.
2. Forgetting `destroy()` when unmounting UI.
3. Attaching before transport points to the right namespace.


# PixelArtCanvas.md

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


# Brush.md

# Brush

Manages primary/secondary colors, brush size, and highlight colors. Computes texture-space pixels covered per stroke. Left-click → `primary`; right-click → `secondary`.

> Reached via `PixelArtCanvas.brush`. For color-picking (`pickArmed` / `pick`), see [BrushTool.md](./BrushTool.md).

## Types

```ts
new Brush(options: BrushOptions)

export type ColorInput = string | Color; // Color is colorjs.io's Color class
export type BrushColorSlot = "primary" | "secondary";

export interface BrushOptions {
  /**
   * Base primary color of the brush. Accepts a CSS color string (hex, rgb(), hsl(),
   * named color, ...) or a colorjs.io `Color` instance.
   * Opacity can be controlled separately with `primary.opacity`.
   * @default "#000000"
   */
  color?: ColorInput;
  /**
   * Base secondary color of the brush, applied by a right-click stroke.
   * @default "#FFFFFF"
   */
  secondaryColor?: ColorInput;
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

## `primary` / `secondary`

```ts
readonly primary: BrushColor
readonly secondary: BrushColor
```

Color+opacity pair. API:

```ts
set(color: ColorInput, opacity?: number): void
asString(format?: "rgba" | "hex"): string
get/set opacity: number
```

- `set(color, opacity?)`: sets the color from a CSS color string or a colorjs.io `Color` instance. If `opacity` is omitted, the current opacity is preserved; otherwise it's clamped to `[0, 1]` and applied alongside the new color.
- `set`: color from CSS string or colorjs.io `Color`. Omit `opacity` to preserve it; otherwise clamped to `[0, 1]`.
- `asString`: defaults to `rgba(r,g,b,a)`; pass `"hex"` for 6-digit hex (no opacity).
- `opacity`: clamped to `[0, 1]` on write.

```ts
brush.primary.set("#FF6600");
brush.primary.opacity = 0.8;
brush.secondary.set("#3366FF", 1);
```

---

### `swapColors`

```ts
swapColors(): void
```

Swaps `primary` ↔ `secondary` (color and opacity).

---

### `size`

```ts
get size(): number
set size(size: number)
```

Brush size in pixels. Clamped to `[1, maxSize]`.

---

### `colorInline`

```ts
get colorInline(): string
set colorInline(color: ColorInput)
```

Inner stroke color of the SVG brush cursor overlay.

---

### `colorOutline`

```ts
get colorOutline(): string
set colorOutline(color: ColorInput)
```

Outer stroke color of the SVG brush cursor overlay.

---

### `affectedPixels`

```ts
affectedPixels(cx: number, cy: number): IterableIterator<Vec2>
```

Yields texture-space `{ x, y }` coords for every pixel in the brush square at `(cx, cy)`. Single-use: iterate once or spread into an array.

- Odd size: center is exactly `(cx, cy)`.
- Even size: offset by `-0.5` to stay grid-aligned.

```ts
// size = 3 → 9 pixels around (10, 10)
canvasBuffer.drawPixels(brush.affectedPixels(10, 10), { r: 255, g: 0, b: 0, a: 255 });
// Reuse:
const pixels = [...brush.affectedPixels(10, 10)];
```


# BrushTool.md

# BrushTool

Color-picking surface of the brush, reached via [`PixelArtCanvas.tools.brush`](../PixelArtCanvas.md#tools). Distinct from [`Brush`](./Brush.md); only exposes the pick-into-`brush.primary` behavior.

```ts
export interface BrushTool {
  pickArmed: boolean;
  pick(x: number, y: number): RGBA | null;
}
```

Three independent paths sample a pixel color into `brush.primary`:

| Path | Trigger | Notes |
|---|---|---|
| `pickArmed = true` | Next left-click in `"paint"` mode | Single-shot; auto-disarms. Switching mode disarms it. |
| `pick(x, y)` | Called directly, anytime | Returns `RGBA` or `null` if out-of-bounds |
| `Ctrl`+right-click | Mousedown in `"paint"` mode | Single-shot; never starts a secondary stroke |

> [!IMPORTANT]
> All paths dispatch a `"colorpicked"` CustomEvent (`detail: { hex, opacity }`, bubbling and composed) on `canvas()`. Use it to sync a UI color swatch.


# FillTool.md

# FillTool

Paint-bucket tool for `"fill"` mode, reached via [`PixelArtCanvas.tools.fill`](../PixelArtCanvas.md#tools).

```ts
export interface FillTool {
  global: boolean;
}
```

## `global`

- `false` (default): floods the 4-connected region from the seed pixel.
- `true`: recolors every matching pixel on the canvas.

Runtime-only: no constructor option. Persists across mode switches.

> [!IMPORTANT]
> A global fill commits as a single atomic edit and broadcasts a compact `"global-fill"` event (`{ fromColor, toColor }`) instead of `"stroke"`. Undo/redo replays it as a full `"stroke"`.


# SelectTool.md

# SelectTool

Public API for `"select"` mode, reached via [`PixelArtCanvas.tools.select`](../PixelArtCanvas.md#tools).

```ts
export interface SelectTool {
  shape: boolean;
  readonly hasSelection: boolean;
  rotate(): boolean;
  flipHorizontal(): boolean;
  flipVertical(): boolean;
}
```

## `shape`

Controls selection start behavior:

- `false` (default): start rectangle selection.
- `true`: magic-wand selection from the clicked connected region.

Runtime-only (no constructor option). Changing it clears the current selection.

> [!IMPORTANT]
> A connected region smaller than 2 pixels does not produce a selection; the click is a no-op.

## `hasSelection`

Read-only. `true` when there is a committed selection to transform; otherwise `false`.

## `rotate` / `flipHorizontal` / `flipVertical`

Programmatic transforms for the active selection.

- `rotate()`: rotate 90 degrees clockwise around selection center.
- `flipHorizontal()`: mirror selection horizontally.
- `flipVertical()`: mirror selection vertically.

Each method returns `false` and does nothing when there is no active selection.


# UVMap.md

# UVMap

Manages a texture's UV regions. Exposed as `PixelArtCanvas.uv`.

- **Creating** a region is API-only: call `uv.create(...)` (e.g. from a toolbar button)
- **Moving** is a canvas gesture: switch to `"uv"` mode, click a region, drag

```ts
new UVMap(options: UVMapOptions)

interface UVMapOptions {
  getCanvasSize: () => Vec2;
}

interface UVRegion {
  id: string;
  rect: SelectionRect; // { x, y, width, height }, texture-pixel space
  color: string;       // CSS color for the overlay border
}

interface UVRegionCreateOptions {
  width: number;
  height: number;
  id?: string;    // default: crypto.randomUUID()
  color?: string; // default: next palette color
}
```

## Events

| Type | Payload |
|---|---|
| `"region-created"` | `region` |
| `"region-deleted"` | `region` (last state before removal) |
| `"region-moved"` | `region`, `previousRect` |
| `"region-dragging"` | `id`, `rect` (transient, not committed) |
| `"selection-changed"` | `selectedRegionId` |
| `"visibility-changed"` | `showAll` |

## Properties

### `regions`

```ts
get regions(): IterableIterator<UVRegion>
```

Live view in insertion order. `UVMap` is itself iterable (`for (const r of uv)`). Spread if you need an array.

### `selectedRegionId`

```ts
get selectedRegionId(): string | null
```

The currently selected region, or `null`. Set by clicking in `"uv"` mode or by `select(id)`.

### `showAll`

```ts
get showAll(): boolean
set showAll(value: boolean)
```

`false` by default. See **Visibility** below.

## Visibility

A region is visible (and hit-testable) only when:

```ts
showAll || region.id === selectedRegionId
```

No region is visible by default. Switching `PixelArtCanvas.mode` away from `"uv"` does **not** change `selectedRegionId` or `showAll`.

## Methods

### `create(options)`

```ts
create(options: UVRegionCreateOptions): UVRegion
```

Places a new region at a cascading offset (clamped to canvas bounds). Emits `"region-created"`.

### `delete(id)`

```ts
delete(id: string): boolean
```

Removes a region. Emits `"region-deleted"`, clears selection if needed. Returns `false` for unknown id.

### `move(id, rect)`

```ts
move(id: string, rect: SelectionRect): boolean
```

Repositions a region (clamped). Emits `"region-moved"`. Returns `false` for unknown id.

### `previewMove(id, rect)`

```ts
previewMove(id: string, rect: SelectionRect): void
```

Emits `"region-dragging"` with a transient rect - no store mutation, no history, no network broadcast. If a drag is cancelled, `UVController` calls this with the region's real rect to snap listeners back.

### `select(id)`

```ts
select(id: string | null): void
```

Sets or clears `selectedRegionId`. Emits `"selection-changed"` only on change.

### `restore(region)`

```ts
restore(region: UVRegion): UVRegion
```

Re-adds a region as-is (no cascading placement). Emits `"region-created"`. Used internally for undo/redo and network hydration.

### `clear()`

```ts
clear(): void
```

Deletes all regions (each emits `"region-deleted"`) and resets cascading placement.

### `on(type, listener)` / `off(type, listener)`

```ts
on<T extends UVMapEventType>(type: T, listener: UVMapListener<T>): void
off<T extends UVMapEventType>(type: T, listener: UVMapListener<T>): void
```

Typed pub/sub. Listeners get full type inference.

## History & network

Undo/redo and network sync reuse the same events `create`/`delete`/`move` emit - no separate replay handling needed.

- **History:** `"uv-create"`/`"uv-delete"`/`"uv-move"` entries in [`HistoryStack`](../history/HistoryStack.md). Undo calls the inverse method (e.g. undoing a create calls `delete`), which re-emits the matching event naturally.
- **Network:** `onBufferUpdated` fires `"uv-region-*"` events for local changes. See [buffer/PixelBuffer.md](../buffer/PixelBuffer.md) and [network/PixelSyncServer.md](../network/PixelSyncServer.md).

## Example

```ts
canvas.uv.on("region-created", ({ region }) => spawnCubeFor(region));
canvas.uv.on("region-deleted", ({ region }) => destroyCubeFor(region.id));
canvas.uv.on("region-moved", ({ region }) => updateCubeUVs(region.id, region.rect));
canvas.uv.on("region-dragging", ({ id, rect }) => updateCubeUVs(id, rect));

createButton.onclick = () => canvas.uv.create({ width: 16, height: 16 });

deleteButton.onclick = () => {
  const id = canvas.uv.selectedRegionId;
  if (id) canvas.uv.delete(id);
};

onMeshClicked((regionId) => canvas.uv.select(regionId));
```


