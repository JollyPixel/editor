# Touchpad

`Touchpad` tracks up to ten browser touch identifiers with per-touch position
and frame transitions. It is intended for touch-screen events. Laptop
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
  position: { x: number; y: number };
}
```

The names map directly to browser touch identifiers `0`, `1`, and `2`.
Numeric actions can address any identifier from `0` through `9`.

## State and gestures

```ts
declare class Touchpad {
  static readonly MaxTouches: 10;

  touches: TouchState[];
  touchesDown: boolean[];

  readonly wasActive: boolean;
  readonly isOneFingerGesture: boolean;
  readonly isTwoFingerGesture: boolean;
  readonly isThreeFingerGesture: boolean;

  update(): void;
  reset(): void;
}
```

`touchesDown` changes immediately when touch events arrive. `update()`
compares it with the previous state and publishes `wasStarted` and `wasEnded`
for one input step. A start and end must be separated by an update if the
caller needs to observe both transitions.

The gesture getters read `touchesDown` directly. They report whether
identifiers `0`, `0 + 1`, or `0 + 1 + 2` are currently down. They do not
count arbitrary active identifiers.

`wasActive` is true while any touch is down. `reset()` replaces all ten
states with their initial values and clears every raw down flag.

`touches` and `touchesDown` are mutable public arrays. Query methods are the
safer surface for ordinary polling.

## Queries

```ts
interface Touchpad {
  touchState(identifier: TouchAction): TouchState;
  isDown(identifier: TouchAction): boolean;
  wasStarted(identifier: TouchAction): boolean;
  wasEnded(identifier: TouchAction): boolean;
}
```

`touchState()` returns the live `TouchState` stored by the device. The three
flag methods read that same object.

An identifier below `0` or at least `Touchpad.MaxTouches` throws an error
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
output method. It is not exported from the package root.

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

`start` and `move` receive the live position object stored in the matching
`TouchState`. Later movement mutates that object, so copy it if the listener
needs a snapshot. `end` receives only the browser `Touch`.

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
