# Touchpad

`Touchpad` tracks up to ten simultaneous touches with per-touch position and
frame transitions. It is intended for touch-screen events. Laptop
trackpads normally appear through [Mouse](mouse.md).

`Input` connects and updates one automatically, or the device can be used on
its own.

```ts
import {
  TouchIdentifier,
  Touchpad
} from "@jolly-pixel/controls";

const canvas = document.querySelector("canvas");
if (!canvas) {
  throw new Error("No canvas element found");
}

const touchpad = new Touchpad({ canvas });
touchpad.connect();

function gameLoop() {
  touchpad.update();

  if (touchpad.wasStarted(TouchIdentifier.primary)) {
    console.log("Primary touch started");
  }
  if (touchpad.isTwoFingerGesture) {
    console.log("Two touches are down");
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Constructor

```ts
interface TouchpadOptions {
  canvas: CanvasAdapter;
}

new Touchpad(options: TouchpadOptions)
```

An `HTMLCanvasElement` satisfies the structural `CanvasAdapter` type. The
adapter type is not exported from the package root.

## Types

```ts
const TouchIdentifier = {
  primary: 0,
  secondary: 1,
  tertiary: 2
} as const;

type TouchAction = number | keyof typeof TouchIdentifier;
type TouchPosition = { x: number; y: number };

interface TouchState {
  isDown: boolean;
  wasStarted: boolean;
  wasEnded: boolean;
  position: TouchPosition;
}
```

Each touch takes the lowest free slot when it starts and keeps it until it
ends, whatever its browser `identifier`. `TouchIdentifier` names slots `0`,
`1`, and `2`; numeric actions address slots `0` through `9`. Touches beyond
the tenth are ignored.

## State and gestures

```ts
declare class Touchpad {
  static readonly MaxTouches: 10;

  readonly wasActive: boolean;
  readonly isOneFingerGesture: boolean;
  readonly isTwoFingerGesture: boolean;
  readonly isThreeFingerGesture: boolean;

  update(): void;
  sample(): void;
  publish(reader: InputReader): void;
  reset(): void;
}
```

`isDown()` changes as soon as touch events arrive. `update()` publishes
`wasStarted` and `wasEnded` for one input step. A touch that starts and ends
between two updates reports both.

`update()` is `sample()` then `publish("step")`. A fixed-step engine calls
`sample()` and `publish(reader)` separately; see
[Input](./input.md#publishreader).

The gesture getters report whether slots `0`, `0 + 1`, or `0 + 1 + 2` are
currently down.

`wasActive` is true when the latest sample had a touch down or an edge.
`reset()` frees every slot and drops pending edges without reporting an end.

## Queries

```ts
interface Touchpad {
  touchState(identifier: TouchAction): TouchState;
  isDown(identifier: TouchAction): boolean;
  wasStarted(identifier: TouchAction): boolean;
  wasEnded(identifier: TouchAction): boolean;
}
```

`touchState()` returns a new snapshot of one slot.

A slot below `0` or at least `Touchpad.MaxTouches` throws an error
whose message contains the invalid index. A named action resolves through
`TouchIdentifier`.

## Position

```ts
interface Touchpad {
  viewportPosition(
    identifier: TouchAction
  ): Vector2Like;

  viewportPositionTo<T extends Vector2Like>(
    identifier: TouchAction,
    out: T
  ): T;
}
```

Touch positions use canvas-local CSS pixels. Start and move handlers subtract
the target's bounding rectangle from `clientX` and `clientY`.

`viewportPosition()` normalizes the stored position into `[-1, 1]` on both
axes and flips Y. It returns a new object. `viewportPositionTo()` writes into
a caller-owned object and returns it.

`Vector2Like` is the structural `{ x: number; y: number }` shape used by the
output method. It is exported from the package root.

## Events

```ts
type TouchEvents = {
  start: (
    touch: Touch,
    position: TouchPosition
  ) => void;
  move: (
    touch: Touch,
    position: TouchPosition
  ) => void;
  end: (touch: Touch) => void;
};
```

`start` and `move` receive the live position object of the touch's slot.
Later movement mutates that object, so copy it if the listener needs a
snapshot. `end` receives only the browser `Touch`.

Touch start, move, end, and cancel handlers call `preventDefault()`. A cancel
updates down state and emits `end`.

## Availability

```ts
static isAvailable(): boolean
```

Returns whether `document.documentElement` has an `ontouchstart` property.
The method reads the global `document` and therefore requires a DOM-like
environment.

## Lifecycle

```ts
connect(): void
disconnect(): void
```

`connect()` registers touchstart, touchend, touchmove, and touchcancel
listeners on the canvas. `disconnect()` removes them without resetting state.
