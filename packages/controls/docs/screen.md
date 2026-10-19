# Screen

`Screen` manages fullscreen intent for one canvas and reports whether that
canvas is the document's fullscreen element. `Input` owns one instance, or the
device can be used on its own.

```ts
import { Screen } from "@jolly-pixel/controls";

const canvas = document.querySelector("canvas");
if (!canvas) {
  throw new Error("No canvas element found");
}

const screen = new Screen({ canvas });
screen.connect();
screen.on("stateChange", (state) => {
  console.log("Fullscreen:", state);
});

// The next click or tap on the canvas requests fullscreen.
screen.enter();
```

Browsers accept a fullscreen request only during a user gesture, so a
connected `Screen` checks the pending request on every mousedown, mouseup, and
touchend on the canvas.

## Constructor

```ts
interface ScreenOptions {
  canvas: CanvasAdapter;
  documentAdapter?: DocumentAdapter;
}

new Screen(options: ScreenOptions)
```

An `HTMLCanvasElement` satisfies `CanvasAdapter`. `documentAdapter` defaults
to `BrowserDocumentAdapter`. The adapter types are referenced by the public
options but are not exported from the package root.

## Types

```ts
type FullscreenState = "active" | "suspended";

interface ScreenBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
```

## Fullscreen flow

```ts
interface Screen {
  wantsFullscreen: boolean;
  wasFullscreen: boolean;

  enter(): void;
  exit(): void;
  reset(): void;
}
```

### `enter()`

Sets `wantsFullscreen` to `true`. The next gesture on the canvas calls
`canvas.requestFullscreen()` unless the canvas is already tracked as
fullscreen. `wantsFullscreen` stays set, so later gestures retry until a
fullscreen change is observed.

### `exit()`

Clears both state flags. It calls `document.exitFullscreen()` only when the
canvas is the current fullscreen element.

### `reset()`

Sets `wantsFullscreen` and `wasFullscreen` to `false`. It does not ask the
document to leave fullscreen; use `exit()` for that.

## State changes and errors

`wasFullscreen` is updated by the document's `fullscreenchange` event. The
device emits `"active"` when the canvas becomes fullscreen and
`"suspended"` when it stops being fullscreen. Repeated events that do not
change the tracked state are ignored.

A `fullscreenerror` event emits `"suspended"` only when
`wasFullscreen` was already true, then clears that flag. An error while the
device is not fullscreen does not emit an event or clear
`wantsFullscreen`.

## Size and bounds

```ts
interface Screen {
  readonly size: Vector2Like;
  readonly bounds: ScreenBounds;

  sizeTo<T extends Vector2Like>(out: T): T;
  boundsTo<T extends ScreenBounds>(out: T): T;
}
```

`size` returns the canvas `clientWidth` and `clientHeight`. `bounds`
centers those dimensions at the origin: `left` and `bottom` are the negative
half-size, while `right` and `top` are the positive half-size.

The property getters return new objects. `sizeTo()` and `boundsTo()` write
into a caller-owned object and return it.

`Vector2Like` is the structural `{ x: number; y: number }` shape used by the
size methods. It is exported from the package root.

## Events

```ts
type ScreenEvents = {
  stateChange: (
    state: FullscreenState
  ) => void;
};
```

`stateChange` reports observed document state. Calling `enter()` alone does
not emit it.

## Lifecycle

```ts
connect(): void
disconnect(): void
```

`connect()` registers the gesture listeners on the canvas, and fullscreenchange
and fullscreenerror listeners on the document adapter. `disconnect()` removes them without leaving fullscreen or
resetting state.
