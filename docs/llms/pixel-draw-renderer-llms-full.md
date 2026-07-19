# README.md

<h1 align="center">
  pixel-draw.renderer
</h1>

<p align="center">
  JollyPixel Pixel Art canvas renderer
</p>

## 📌 About

Browser-based library for editing pixel-art textures. It provides zoom, pan, primary/secondary brush painting, `Ctrl`+right-click color picking, and an SVG cursor overlay.

## 💡 Features

- **Brush painting**: adjustable size, primary/secondary color, and opacity; color inputs accept a CSS string or a [colorjs.io][colorjs] `Color` instance; left-click paints `primary`, right-click paints `secondary`, `Ctrl`+right-click eyedroppers a color from the canvas into `primary`
- **Shift-to-line drawing**: hold `Shift` in paint mode to draw a straight line
- **Paint-bucket fill**: flood-fill a connected region of same-colored pixels
- **Rectangle select, move, copy, delete**: `Ctrl`/`Cmd`+`C`/`V` to copy/duplicate, `Delete` to erase
- **Undo/redo**: optional bounded history over strokes, resizes, and texture replaces; opt in via `history.enabled`
- **Zoom & pan**: mouse-wheel zoom with configurable sensitivity and range; middle-click pan in any mode
- **Transparency support**: checkerboard background renders beneath transparent pixels

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/pixel-draw.renderer
# or
$ yarn add @jolly-pixel/pixel-draw.renderer
```

## 👀 Usage Example

```ts
import { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

const container = document.getElementById("editor-container")!;
const manager = new PixelArtCanvas(container, {
  texture: {
    size: { x: 64, y: 64 }
  },
  zoom: {
    default: 4,
    min: 0.5,
    max: 40
  }
});

manager.onResize();
manager.centerTexture();

manager.brush.primary.set("#FF6600"); // CSS string or a colorjs.io `Color` instance
manager.brush.primary.opacity = 0.8;
manager.brush.secondary.set("#3366FF");
manager.brush.size = 3;

manager.mode = "fill"; // "paint" | "move" | "fill" | "select", see Modes below
```

Loading an existing texture:

```ts
const img = new Image();
img.src = "/assets/sprite.png";
await img.decode();
manager.texture = img;
```

### Modes

`mode` selects how left-click/drag is interpreted. Read [PixelArtCanvas.md](./docs/PixelArtCanvas.md#mode) for the full behavior:

- `"paint"`: left-click draws with `brush.primary`, right-click draws with `brush.secondary` (mutually exclusive — one button's stroke blocks the other from starting); hold `Shift` for a straight line (always `primary`); `Ctrl`+right-click eyedroppers a color into `brush.primary`
- `"move"`: pans the camera
- `"fill"`: flood-fills the clicked region with `brush.primary`; right-click has no effect
- `"select"`: drag to select/move; `Ctrl`/`Cmd`+`C`/`V` copy/paste, `Delete` erases; right-click has no effect

Middle-click pans in any mode.

### Keybinds

Copy/paste/undo/redo/delete are configurable; Shift (line-tool arm/disarm) is not. Defaults:

| Action | Default |
|---|---|
| Copy | `Ctrl`/`Cmd`+`C` |
| Paste | `Ctrl`/`Cmd`+`V` |
| Undo | `Ctrl`/`Cmd`+`Z` |
| Redo | `Ctrl`/`Cmd`+`Y` or `Ctrl`/`Cmd`+`Shift`+`Z` |
| Delete | `Delete` |

Override at construction, or live via `patchKeybindings()`:

```ts
const manager = new PixelArtCanvas(container, {
  keybindings: { undo: "alt+u" } // unspecified actions keep their default
});

manager.patchKeybindings({ redo: "alt+shift+u" });
```

> [!TIP]
> Read [utils/keybindings.md](./docs/utils/keybindings.md) for the combo string format and error handling.

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

- [`PixelArtCanvas`](./docs/PixelArtCanvas.md): top-level coordinator, the primary public API
- [`Brush`](./docs/tools/Brush.md): brush size, primary/secondary color, opacity, and affected-pixel computation — read/write via `PixelArtCanvas.brush`
- [`PixelBuffer`](./docs/buffer/PixelBuffer.md): headless RGBA pixel storage, usable server-side with no DOM
- [`HistoryStack`](./docs/history/HistoryStack.md): bounded undo/redo stack backing `PixelArtCanvas.undo()`/`redo()`
- [`Keybindings`](./docs/utils/keybindings.md): `Keybindings`/`Keybinding` types, `DEFAULT_KEYBINDINGS`, and the errors thrown by `patchKeybindings()`
- [`Network`](./docs/network/index.md): transport-agnostic, server-authoritative multiplayer for `PixelArtCanvas`

## 🧩 Types

Shared value types used across the public API:

```ts
type Vec2 = {
  x: number;
  y: number;
};

type Mode = "paint" | "move" | "fill" | "select";

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


# HistoryStack.md

# HistoryStack

Bounded undo/redo stack over a `DefaultPixelBuffer` (`PixelBuffer` or `CanvasBuffer`) — no DOM or network dependency, so it runs identically headless or in the browser. `PixelArtCanvas`'s internal `HistoryController` owns one when constructed with `history.enabled: true` (see [PixelArtCanvas.md](../PixelArtCanvas.md#undo--redo--canundo--canredo)); most consumers drive undo/redo through `PixelArtCanvas.undo()`/`redo()` rather than this class directly.

`HistoryStack` only owns the stack and replays before/after data against its buffer — capturing that before/after data on each edit is the caller's job (`PixelArtCanvas` does this internally for strokes, resizes, and texture replaces).

## Types

```ts
new HistoryStack(buffer: DefaultPixelBuffer, options?: HistoryStackOptions)

interface HistoryStackOptions {
  /** @default 10 */
  limit?: number;
}

type HistoryEntry =
  | {
    action: "stroke";
    timestamp: number;
    positions: Vec2[];
    beforeColors: RGBA[];
    afterColor: RGBA;
  }
  | {
    action: "resized";
    timestamp: number;
    beforeSize: Vec2;
    beforePixels: Uint8ClampedArray;
    afterSize: Vec2;
    afterPixels: Uint8ClampedArray;
  }
  | {
    action: "texture-replaced";
    timestamp: number;
    beforeSize: Vec2;
    beforePixels: Uint8ClampedArray;
    afterSize: Vec2;
    afterPixels: Uint8ClampedArray;
  }
  | {
    action: "select-edit";
    timestamp: number;
    positions: Vec2[];
    beforeColors: RGBA[];
    afterColors: RGBA[];
  };

/** Same as HistoryEntry, minus `timestamp` — stamped by `push()`. */
type HistoryEntryInput = Omit<HistoryEntry, "timestamp">;
```

`limit` bounds the undo stack: pushing past it silently drops the oldest entry. A `"stroke"` entry's `beforeColors` is per-position (a stroke can cross pixels of different colors); `afterColor` is a single color since a stroke always paints one uniform color. `"resized"`/`"texture-replaced"` instead snapshot the whole buffer (`beforePixels`/`afterPixels`) since there's no cheaper diff to keep. `"select-edit"` covers every `"select"`-mode edit (move/delete/paste/rotate/flip) with a single entry shape: unlike `"stroke"`, both `beforeColors` and `afterColors` are per-position, since these operations paint heterogeneous, multi-colored regions rather than one uniform color. `positions` is the union of whatever footprint(s) the edit touched (e.g. a Move's source and destination, or a Rotate's pre/post footprint when a non-square selection's dimensions swap) — see [PixelArtCanvas.md](../PixelArtCanvas.md#undo--redo--canundo--canredo) for the network-sync caveat specific to this entry type.

## Properties

### `canUndo` / `canRedo`

```ts
get canUndo(): boolean
get canRedo(): boolean
```

Whether there's an entry to undo/redo.

## Methods

### `push`

```ts
push(entry: HistoryEntryInput): void
```

Stamps the entry with the current time (`Date.now()`) and pushes it onto the undo stack, clearing the redo stack. Drops the oldest undo entry once `limit` is exceeded. The timestamp is preserved across future undo/redo replays — see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md) for why this matters over the network.

---

### `undo`

```ts
undo(): HistoryEntry | null
```

Reverts the most recent entry (applying its `before*` data to the buffer) and moves it to the redo stack. Returns `null` without touching the buffer when there's nothing to undo.

---

### `redo`

```ts
redo(): HistoryEntry | null
```

Re-applies the most recently undone entry (applying its `after*` data to the buffer) and moves it back to the undo stack. Returns `null` without touching the buffer when there's nothing to redo.

---

### `clear`

```ts
clear(): void
```

Discards every recorded entry, both stacks. Call when the buffer is replaced wholesale from outside the stack's knowledge (e.g. a remote resize/texture-replace/snapshot — `PixelArtCanvas` does this automatically in `applyRemoteCommand`/`loadSnapshot`).


# ConflictResolver.md

# ConflictResolver

Conflicts are resolved **per pixel**, not per command. A single stroke command can touch thousands of pixels, so [`PixelSyncServer`](./PixelSyncServer.md) splits a command: pixels that lose the race are dropped from the applied/broadcast copy, the rest are applied normally. `"buffer-added"`, `"buffer-removed"`, `"resized"`, `"texture-replaced"`, and `"global-fill"` are always accepted with no per-pixel arbitration; only `"stroke"` goes through a resolver. `"global-fill"` carries no position list to arbitrate against (see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md)) — it's applied by recomputing matching pixels against the server's own authoritative buffer at receive-time, which is self-consistent as long as commands are applied in the order the server processes them.

## Types

```ts
interface PixelConflictContext {
  incoming: PixelNetworkCommandHeader;
  /**
   * Header of the last accepted command at the same pixel, if any.
   * `undefined` means no prior command exists at that pixel → always accept.
   */
  existing: PixelNetworkCommandHeader | undefined;
}

/**
 * Determines whether an incoming command should be accepted or rejected
 * given the last known command header at the same pixel.
 *
 * Only the header is tracked (not the full stroke command) since a single
 * stroke can touch thousands of pixels — keeping a full command per pixel
 * would be wasteful.
 */
interface PixelConflictResolver {
  resolve(ctx: PixelConflictContext): "accept" | "reject";
}
```

## `LastWriteWinsResolver`

The default resolver. Higher `timestamp` wins. On a timestamp tie, the lexicographically greater `clientId` wins, giving a deterministic total order without coordination.

```ts
import { LastWriteWinsResolver } from "@jolly-pixel/pixel-draw.renderer";

const server = new PixelSyncServer({
  conflictResolver: new LastWriteWinsResolver() // default, no need to pass explicitly
});
```

## Custom resolver

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


# index.md

# Network Sync Layer

Transport-agnostic, server-authoritative multiplayer for `PixelArtCanvas`. Multiple
clients can share the same texture(s) in real time. Structurally mirrors
`@jolly-pixel/voxel.renderer`'s network layer but is an independent
implementation: this package has no dependency on voxel-renderer.

## Architecture

```
┌───────────────┐  onBufferUpdated   ┌──────────────────┐   sendCommand   ┌─────────────┐
│ PixelArtCanvas │───────────────────▶│ PixelSyncSession │────────────────▶│  Transport  │
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

A `PixelArtCanvas` has no concept of a buffer identity; it owns exactly one
texture. [`PixelSyncSession`](./PixelSyncSession.md) assigns that texture a `bufferId` and can attach
several `PixelArtCanvas` instances to the same transport connection (e.g. one
per open tileset).

**Flow:**
1. A local mutation (a paint stroke, fill, resize, or setting `texture`) fires
   `PixelArtCanvas.onBufferUpdated` (see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md)).
2. `PixelSyncSession` stamps the event with `bufferId` / `clientId` / `seq` /
   `timestamp` and calls `transport.sendCommand(cmd)`.
3. The transport delivers the command to [`PixelSyncServer.receive()`](./PixelSyncServer.md).
4. The server resolves conflicts (see [ConflictResolver](./ConflictResolver.md)), applies the command to its authoritative
   [`PixelWorld`](./PixelWorld.md), and broadcasts it to clients subscribed to that buffer.
5. Each subscribed client's transport calls `onCommand(cmd)`, which
   `PixelSyncSession` routes to the matching `PixelArtCanvas.applyRemoteCommand()`.
6. `applyRemoteCommand` suppresses `onBufferUpdated` while applying, so the
   result is never re-broadcast: no echo loop.

Buffers are not sent in bulk. A client receives a buffer's pixel data only
when it subscribes to that specific `bufferId` (via `attach`/`createBuffer`).

## Pieces

| Module | Description |
|---|---|
| [types](./types.md) | `PixelNetworkCommand` wire format and its constituent event types |
| [PixelTransport](./PixelTransport.md) | Transport-agnostic interface consumers implement (WebSocket, WebRTC, ...) |
| [PixelSyncSession](./PixelSyncSession.md) | Client-side, multi-buffer orchestrator |
| [PixelSyncServer](./PixelSyncServer.md) | Headless, server-authoritative sync manager |
| [PixelWorld](./PixelWorld.md) | Headless, multi-buffer pixel registry used by the server |
| [PixelCommandApplier](./PixelCommandApplier.md) | `applyCommandToWorld`, headless command replay |
| [ConflictResolver](./ConflictResolver.md) | Per-pixel conflict resolution strategy (`LastWriteWinsResolver` and custom resolvers) |


# PixelCommandApplier.md

# PixelCommandApplier

## `applyCommandToWorld`

```ts
function applyCommandToWorld(world: PixelWorld, cmd: PixelNetworkCommand): void
```

Applies a single network command to a headless [`PixelWorld`](./PixelWorld.md) instance. Used internally by [`PixelSyncServer`](./PixelSyncServer.md) (Node.js, no DOM), and usable standalone for server-side logic, unit tests, or replaying a command log without a renderer.

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


# PixelSyncServer.md

# PixelSyncServer

Headless, server-authoritative pixel sync manager. Has no DOM/Canvas2D dependency and runs in Node.js, Deno, or Bun.

Workflow:
1. `connect(client)`: register a peer; notifies existing peers. Sends no buffer data.
2. `subscribe(clientId, bufferId)`: sends that buffer's current snapshot, if it exists.
3. `receive(cmd)`: validate, apply to the world, and broadcast to subscribers of that buffer.
4. `disconnect(clientId)`: remove the client and notify peers.

## Types

```ts
new PixelSyncServer(options?: PixelSyncServerOptions)

interface PixelSyncServerOptions {
  /**
   * Existing PixelWorld to use as the authoritative state.
   * A new (empty) world is created when omitted.
   */
  world?: PixelWorld;
  /**
   * Custom conflict resolver.
   * Defaults to LastWriteWinsResolver.
   */
  conflictResolver?: PixelConflictResolver;
}

/**
 * A connected client handle. The consumer creates these objects and passes
 * them to PixelSyncServer.connect(). The server calls send() to transmit
 * data back to the real network peer.
 */
interface ClientHandle {
  readonly id: string;
  /**
   * Transmit data to this client over the underlying transport.
   * The consumer is responsible for framing (JSON-stringify, etc.).
   */
  send(data: unknown): void;
}

type PixelStrokeCommand = Extract<PixelNetworkCommand, { action: "stroke"; }>;
```

## Properties

### `world`

```ts
readonly world: PixelWorld
```

The authoritative [`PixelWorld`](./PixelWorld.md) instance.

## Methods

### `connect` / `disconnect`

```ts
connect(client: ClientHandle): void
disconnect(clientId: string): void
```

`connect` registers the client and notifies existing peers (`{ type: "peer-joined", peerId }`); sends no buffer data. `disconnect` removes the client and notifies remaining peers (`{ type: "peer-left", peerId }`).

---

### `subscribe` / `unsubscribe`

```ts
subscribe(clientId: string, bufferId: string): void
unsubscribe(clientId: string, bufferId: string): void
```

`subscribe` subscribes the client to a buffer's future updates and immediately sends its current snapshot (`{ type: "snapshot", bufferId, data }`), if the buffer already exists. `unsubscribe` stops broadcasting that buffer's updates to the client.

---

### `receive`

```ts
receive(cmd: PixelNetworkCommand): void
```

Processes an incoming command:
- `"buffer-added"`: creates the buffer if it doesn't already exist, then broadcasts.
- `"buffer-removed"`: deletes the buffer and its conflict-tracking state, then broadcasts.
- `"stroke"`: resolves conflicts per-pixel (see [ConflictResolver](./ConflictResolver.md)); applies and broadcasts only the accepted pixels. Dropped entirely (no broadcast) if nothing was accepted.
- `"resized"` / `"texture-replaced"` / `"global-fill"`: always accepted, applied, and broadcast — `"global-fill"` carries no position list, so it can't be arbitrated per pixel; see [ConflictResolver](./ConflictResolver.md).

Commands targeting an unknown buffer (other than `"buffer-added"`) are dropped.

---

### `snapshot`

```ts
snapshot(bufferId: string): PixelBufferSnapshot | undefined
```

Returns the buffer's current state, or `undefined` if it doesn't exist.

## Example

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


# PixelSyncSession.md

# PixelSyncSession

Client-side network orchestrator. A single `PixelSyncSession` multiplexes many buffers (textures/tilesets) over one [`PixelTransport`](./PixelTransport.md) connection. Each attached `PixelArtCanvas` still owns exactly one texture; the session just assigns it a `bufferId` for routing:

- Local mutations from an attached `PixelArtCanvas` are stamped and forwarded.
- Remote commands are routed to the matching `PixelArtCanvas` by `bufferId`.
- Buffer lifecycle (add/remove) is announced/received at the session level.

One `PixelSyncSession` per transport connection. Each `PixelArtCanvas` is attached under exactly one `bufferId`.

## Types

```ts
new PixelSyncSession(options: PixelSyncSessionOptions)

interface PixelSyncSessionOptions {
  transport: PixelTransport;
}
```

## Properties

### `onBufferAdded` / `onBufferRemoved`

```ts
onBufferAdded: ((bufferId: string, metadata: { size: Vec2; pixels?: string; }) => void) | null
onBufferRemoved: ((bufferId: string) => void) | null
```

Called when a **peer** creates or removes a buffer this session hasn't (yet) attached to itself.

## Methods

### `attach`

```ts
attach(bufferId: string, canvasManager: PixelArtCanvas): void
```

Attaches an existing `PixelArtCanvas` to sync as `bufferId`. Assumes the buffer already exists on the server; subscribes and awaits its snapshot via `transport.onSnapshot`. Throws if `bufferId` is already attached.

---

### `createBuffer`

```ts
createBuffer(bufferId: string, canvasManager: PixelArtCanvas, options: { size: Vec2; pixels?: string; }): void
```

Attaches a `PixelArtCanvas` **and** announces a brand new buffer to peers, carrying the manager's current pixel data as the initial shared state.

---

### `detach` / `removeBuffer`

```ts
detach(bufferId: string): void
removeBuffer(bufferId: string): void
```

`detach` stops syncing a texture without announcing anything to peers (e.g. the user closed that tab). `removeBuffer` does the same, and also tells peers the buffer is gone.

---

### `destroy`

```ts
destroy(): void
```

Detaches every buffer and clears the transport's `onCommand`/`onSnapshot` callbacks. Call when the session ends.

## Example

```ts
import { fromUint8Array } from "js-base64";
import { PixelSyncSession } from "@jolly-pixel/pixel-draw.renderer";

const session = new PixelSyncSession({ transport: myTransport });

// Attach an existing texture, assumed to already exist on the server.
// Subscribes and receives its snapshot asynchronously via onSnapshot.
session.attach("tileset-1", canvasManager);

// Attach AND announce a brand new buffer, seeding peers with its current pixels.
session.createBuffer("tileset-2", otherPixelArtCanvas, {
  size: otherPixelArtCanvas.textureSize,
  pixels: fromUint8Array(new Uint8Array(otherPixelArtCanvas.texture))
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


# PixelTransport.md

# PixelTransport

Transport-agnostic interface for sending and receiving pixel network commands. Consumers implement it with a concrete transport layer (WebSocket, WebRTC, Partykit, BroadcastChannel, etc.) and pass an instance to [`PixelSyncSession`](./PixelSyncSession.md).

## Types

```ts
interface PixelTransport {
  /** The client ID assigned to the local peer by the transport layer. */
  readonly localClientId: string;

  /** Sends a local mutation or lifecycle command to the server / peers. */
  sendCommand(command: PixelNetworkCommand): void;
  subscribe(bufferId: string): void;
  unsubscribe(bufferId: string): void;

  /**
   * Called by the transport when a command arrives from a remote peer.
   * Set this before connecting.
   */
  onCommand: ((command: PixelNetworkCommand) => void) | null;

  /**
   * Called by the transport when the server sends a buffer snapshot
   * (in response to subscribe). Set this before connecting.
   */
  onSnapshot: ((bufferId: string, snapshot: PixelBufferSnapshot) => void) | null;

  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}
```

## WebSocket example stub

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


# PixelWorld.md

# PixelWorld

Headless, multi-buffer registry. Used by [`PixelSyncServer`](./PixelSyncServer.md) as the authoritative store for every buffer (texture) shared in a session. Has no DOM/Canvas2D dependency and runs in Node.js / Deno / Bun.

## Types

```ts
new PixelWorld()
```

No constructor options; buffers are added individually via `addBuffer`.

## Methods

### `addBuffer`

```ts
addBuffer(bufferId: string, options: PixelBufferOptions): PixelBuffer
```

Creates and registers a new [`PixelBuffer`](../buffer/PixelBuffer.md) under `bufferId`. Throws if `bufferId` already exists.

---

### `removeBuffer`

```ts
removeBuffer(bufferId: string): void
```

---

### `getBuffer`

```ts
getBuffer(bufferId: string): PixelBuffer | undefined
```

---

### `hasBuffer`

```ts
hasBuffer(bufferId: string): boolean
```

---

### `getBufferIds`

```ts
getBufferIds(): IterableIterator<string>
```


# types.md

# network/types

Wire-format types for the [network sync layer](./index.md).

## Types

```ts
/**
 * Buffer create/destroy events. A PixelArtCanvas has no concept of a bufferId
 * so these are never emitted from a PixelArtCanvas's onBufferUpdated hook —
 * they are constructed directly by PixelSyncSession.createBuffer/removeBuffer.
 */
type PixelLifecycleEvent =
  | {
    action: "buffer-added";
    metadata: {
      size: Vec2;
      /** Base64-encoded RGBA bytes for the buffer's initial content, if any. */
      pixels?: string;
    };
  }
  | {
    action: "buffer-removed";
    metadata: Record<string, never>;
  };

type PixelNetworkEvent = PixelBufferHookEvent | PixelLifecycleEvent;

interface PixelNetworkCommandHeader {
  bufferId: string;
  clientId: string;
  /** Monotonically increasing sequence number per client. */
  seq: number;
  /** Unix timestamp in milliseconds when the command was created. */
  timestamp: number;
}

/**
 * A network command is a buffer event enriched with routing metadata.
 * It can be sent over any transport (WebSocket, WebRTC, Partykit, etc.).
 */
type PixelNetworkCommand = PixelNetworkEvent & PixelNetworkCommandHeader;

interface PixelBufferSnapshot {
  size: Vec2;
  /** Base64-encoded RGBA bytes. */
  pixels: string;
}
```

`PixelBufferHookEvent` (the `"stroke"` / `"resized"` / `"texture-replaced"` / `"global-fill"` local-mutation events) is defined in [buffer/PixelBuffer.md](../buffer/PixelBuffer.md); a `PixelNetworkCommand` is that same event shape plus `PixelLifecycleEvent`, enriched with the header fields. Six actions total: `"buffer-added"`, `"buffer-removed"`, `"stroke"`, `"resized"`, `"texture-replaced"`, `"global-fill"`. All pixel payloads (`stroke` positions and `global-fill`'s colors excepted) are raw RGBA bytes, base64-encoded via `js-base64`: no image codec dependency, so `PixelSyncServer` stays headless. Commands are plain JSON-serializable objects.


# PixelArtCanvas.md

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
     * @default fully transparent
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

The brush instance. Use it to read or change the primary/secondary brush colors, opacity, and size. See [Brush.md](./tools/Brush.md).

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

Reads or sets the current interaction mode. `"paint"` routes left-click events to brush drawing with `brush.primary` (holding `Shift` arms a line tool, always drawn in `primary`) and right-click events to brush drawing with `brush.secondary` — the two buttons paint mutually exclusively, a stroke already in progress on one button blocks the other from starting until it ends; `"move"` routes left-click to panning; `"fill"` routes a left-click to a paint-bucket fill with `brush.primary` (contiguous region by default, or every same-colored pixel on the canvas when `fillGlobal` is `true` — see below; right-click has no effect in this mode); `"select"` routes them to a rectangle-selection tool: drag to select or move, `Ctrl`/`Cmd`+`C`/`V` to copy/duplicate, `Delete` to erase, `R` to rotate the selection 90° clockwise around its center (repeatable — press again for further rotation; no counterclockwise binding), `H`/`V` to flip the selection's content horizontally/vertically in place. The line/fill/select tools are internal implementation details with no public class of their own.

A drag that never grows past its starting pixel (a plain click) does not create a selection.

Switching to `"move"` cancels an armed line. Switching away from `"select"` clears any active selection.

The SVG brush-cursor highlight is active in `"paint"` and `"fill"` modes. In `"fill"`, and in `"paint"` while `pickColorArmed` is `true`, the highlight is always a single pixel regardless of `brush`'s configured size, since neither a fill's seed nor a color pick is brush-sized.

---

### `fillGlobal`

```ts
get fillGlobal(): boolean
set fillGlobal(global: boolean)
```

Reads or sets whether `"fill"` mode recolors every pixel matching the seed's color anywhere on the canvas (`true`) instead of only the seed's 4-directionally connected region (`false`, the default). Runtime-only — there is no constructor option — and the setting persists across mode switches, mirroring `brush`'s size/color.

A global fill is still committed and undoable as a single atomic edit, but is broadcast over `onBufferUpdated`/the network layer as a compact `"global-fill"` event (`{ fromColor, toColor }`, no position list) rather than `"stroke"`, since it can touch a large fraction of the canvas — see [buffer/PixelBuffer.md](./buffer/PixelBuffer.md). Undoing/redoing a global fill falls back to a full-position `"stroke"` event.

---

### `pickColorArmed` / `pickColorAt`

```ts
get pickColorArmed(): boolean
set pickColorArmed(armed: boolean)
pickColorAt(x: number, y: number): RGBA | null
```

`pickColorArmed` arms/disarms a one-shot color picker on top of `"paint"` mode — it is not a separate `Mode`. While armed, the next left-click in `"paint"` mode samples that pixel instead of painting, applies it to `brush.primary`, and disarms itself. It has no effect in any other mode, and switching `mode` away from `"paint"` disarms it automatically. A click outside the texture bounds is ignored (no pick, stays armed) rather than sampling transparent black.

`pickColorAt(x, y)` performs the same sample-and-apply immediately at the given texture position, independent of the current mode and of `pickColorArmed` — it's the direct/programmatic entry point, e.g. for a "pick color" toolbar button that should always work regardless of what mode is active. Returns the sampled `RGBA`, or `null` (brush left untouched) when `(x, y)` is outside the texture.

`Ctrl`+right-click in `"paint"` mode is a third, always-available path to the same one-shot pick into `brush.primary`: it's a single-shot sample-and-apply at mousedown (not tracked as a drag, and does not start a `brush.secondary` stroke), independent of `pickColorArmed`.

Every path dispatches a `"colorpicked"` CustomEvent (`detail: { hex, opacity }`, bubbling and composed) on the element returned by `canvas()`, for UI that mirrors the pick onto a color swatch. Plain right-click (no `Ctrl`) is not a picker — see `mode` above for what it does instead.

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


# Brush.md

# Brush

`Brush` manages the primary/secondary brush colors, size, and highlight colors, and computes the list of texture-space pixels a brush stroke covers. Left-click paints with `primary`; right-click paints with `secondary`.

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

Each is a `BrushColor` value object — a color+opacity pair:

```ts
set(color: ColorInput, opacity?: number): void
asString(format?: "rgba" | "hex"): string
get/set opacity: number
```

- `set(color, opacity?)`: sets the color from a CSS color string or a colorjs.io `Color` instance. If `opacity` is omitted, the current opacity is preserved; otherwise it's clamped to `[0, 1]` and applied alongside the new color.
- `asString(format?)`: returns the color. Defaults to an `rgba(r, g, b, a)` string; pass `"hex"` for a 6-digit hex string (opacity is not represented in hex output).
- `opacity`: clamped to `[0, 1]` on assignment.

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

Exchanges `primary` and `secondary` (color and opacity both).

---

### `size`

```ts
get size(): number
set size(size: number)
```

The brush size in pixels. Assigned values are clamped to `[1, maxSize]`.

---

### `colorInline`

```ts
get colorInline(): string
set colorInline(color: ColorInput)
```

The inner stroke color of the SVG brush cursor overlay.

---

### `colorOutline`

```ts
get colorOutline(): string
set colorOutline(color: ColorInput)
```

The outer stroke color of the SVG brush cursor overlay.

---

### `affectedPixels`

```ts
affectedPixels(cx: number, cy: number): IterableIterator<Vec2>
```

A generator yielding texture-space `{ x, y }` coordinates for every pixel within the current brush square centered at `(cx, cy)`. Lazy and single-use: each call produces a fresh iterator; iterate it once (`for...of`, spread, or pass it directly to something that accepts an `Iterable<Vec2>`) rather than storing and re-reading it.

- For **odd** brush sizes the center pixel is exactly `(cx, cy)`.
- For **even** brush sizes the brush is offset by `−0.5` to remain grid-aligned.

**Example**

```ts
// size = 3 → 9 pixels around (10, 10)
canvasBuffer.drawPixels(brush.affectedPixels(10, 10), { r: 255, g: 0, b: 0, a: 255 });

// Or, if you need to consume the pixels more than once:
const pixels = [...brush.affectedPixels(10, 10)];
```


# keybindings.md

# utils/keybindings

Types, defaults, and errors for `PixelArtCanvas`'s configurable keyboard shortcuts (`PixelArtCanvasOptions.keybindings`, `PixelArtCanvas.patchKeybindings()` / `keybindings`, see [PixelArtCanvas.md](../PixelArtCanvas.md)).

## Types

```ts
type ModifierToken = "mod" | "shift" | "alt";

type NamedKey =
  | "Delete" | "Backspace" | "Enter" | "Escape" | "Tab" | "Space"
  | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
  | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10" | "F11" | "F12";

type Keybinding =
  | NamedKey | (string & {})
  | `${ModifierToken}+${NamedKey | (string & {})}`
  | `${ModifierToken}+${ModifierToken}+${NamedKey | (string & {})}`
  | `${ModifierToken}+${ModifierToken}+${ModifierToken}+${NamedKey | (string & {})}`;

type KeybindingAction =
  | "copy" | "paste" | "undo" | "redo" | "delete"
  | "rotate" | "flipHorizontal" | "flipVertical";

type Keybindings = Record<KeybindingAction, Keybinding | Keybinding[]>;
```

A `Keybinding` is a `+`-separated combo string, e.g. `"mod+z"` or `"mod+shift+z"`. `"mod"` matches either Ctrl or Cmd, so a binding behaves the same on every platform. The key segment is matched against the character produced (`KeyboardEvent.key`, case-insensitive), not physical key position, so `"z"` means "whatever key produces the Z character on the user's layout" — correct on AZERTY/QWERTZ without the DSL needing to know about layouts. `NamedKey` lists the non-printable keys for editor autocomplete; any other string is still accepted.

Only `copy`, `paste`, `undo`, `redo`, `delete`, `rotate`, `flipHorizontal`, and `flipVertical` are configurable. Shift (used to arm/disarm the line tool in `"paint"` mode) is not.

## Constants

```ts
const DEFAULT_KEYBINDINGS: Keybindings = {
  copy: "mod+c",
  paste: "mod+v",
  undo: "mod+z",
  redo: ["mod+y", "mod+shift+z"],
  delete: "Delete",
  rotate: "r",
  flipHorizontal: "h",
  flipVertical: "v"
};
```

The keybindings `PixelArtCanvas` uses when `keybindings` isn't passed to its options, and the base a partial override is merged onto. `redo` has two default triggers; any action may be given an array of alternate bindings. `rotate`/`flipHorizontal`/`flipVertical` only have an effect in `"select"` mode with an active selection (rotate is clockwise-only — press it multiple times for other angles).

Matching is exact on modifiers: `"mod+c"` does **not** also match Ctrl+Shift+C, and the default `"Delete"` binding (no modifier) does not also match Ctrl+Delete.

## Errors

```ts
class InvalidKeybindingError extends Error {}
class KeybindingConflictError extends Error {}
```

Both are thrown synchronously from the constructor's `keybindings` option and from `patchKeybindings()` — never asynchronously, and never left as a silently-dropped binding. `InvalidKeybindingError` is thrown for a malformed combo string (unknown modifier token, empty/missing key segment). `KeybindingConflictError` is thrown when two different actions would resolve to the same combo.


