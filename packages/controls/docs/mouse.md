# Mouse

`Mouse` tracks buttons, canvas-local position, movement, wheel input,
double-clicks, and pointer lock. `Input` owns one instance and mirrors primary
touch input into it.

```ts
import {
  Mouse,
  MouseEventButton
} from "@jolly-pixel/controls";

const canvas = document.querySelector("canvas");
if (!canvas) {
  throw new Error("No canvas element found");
}

const mouse = new Mouse({ canvas });
mouse.connect();

function gameLoop() {
  mouse.update();

  if (mouse.wasJustPressed(MouseEventButton.left)) {
    console.log("Left click!");
  }
  if (mouse.isScrolling()) {
    console.log("Scroll:", mouse.scroll);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Constructor

```ts
interface MouseOptions {
  canvas: CanvasAdapter;
  documentAdapter?: DocumentAdapter;
}

new Mouse(options: MouseOptions)
```

An `HTMLCanvasElement` satisfies `CanvasAdapter`. `documentAdapter` defaults
to `BrowserDocumentAdapter`. The adapter types are referenced by the public
options but are not exported from the package root.

## Types

```ts
const MouseEventButton = {
  left: 0,
  middle: 1,
  right: 2,
  back: 3,
  forward: 4,
  scrollUp: 5,
  scrollDown: 6
} as const;

type MouseAction = keyof typeof MouseEventButton;
type InputMouseAction = number | MouseAction | "ANY" | "NONE";
type MouseLockState = "locked" | "unlocked";

interface MouseButtonState {
  isDown: boolean;
  doubleClicked: boolean;
  wasJustPressed: boolean;
  wasJustReleased: boolean;
}
```

`scrollUp` and `scrollDown` are virtual buttons created from the wheel's Y
direction. They publish one-frame button transitions and discard wheel
magnitude. Use `scroll` when magnitude or horizontal input matters.

## Frame state

```ts
interface Mouse {
  update(): void;
  publishFrameState(): void;
  reset(): void;

  readonly wasActive: boolean;
  isMoving(): boolean;
  isScrolling(): boolean;
}
```

DOM and synchronized touch events write live input state. `update()` samples
that state and publishes button transitions, double-clicks, wheel input, and
movement for the current input step. A complete press and release between two
updates still publishes both edges.

`publishFrameState()` republishes every transient accumulated since its
previous call. Fixed-step engines use it before rendering so edges consumed by
earlier catch-up updates remain visible to the rendered update.

`update()` returns early while the mouse is idle. `reset()` clears button,
wheel, position, and delta state.

## Button queries

```ts
interface Mouse {
  isDown(action: InputMouseAction): boolean;
  wasJustPressed(action: InputMouseAction): boolean;
  wasJustReleased(action: InputMouseAction): boolean;
  buttonState(
    action: number | MouseAction
  ): Readonly<MouseButtonState>;
}
```

The direct queries accept a button name, numeric index, `"ANY"`, or `"NONE"`.
An index outside `0` through `6` behaves as an unpressed button.

`buttonState()` returns a new snapshot containing the four state flags. Use
the direct queries on per-frame paths when only one flag is needed.

`doubleClicked` is published by the update after a `dblclick` event and clears
on the following update.

## Position and movement

```ts
interface Mouse {
  newPosition: { x: number; y: number } | null;
  newDelta: { x: number; y: number };

  readonly position: { x: number; y: number };
  readonly delta: { x: number; y: number };
  readonly viewportPosition: Vector2Like;
  readonly worldPosition: Vector2Like;

  viewportDelta(
    normalizeWithSize?: boolean
  ): Vector2Like;

  positionTo<T extends Vector2Like>(out: T): T;
  deltaTo<T extends Vector2Like>(out: T): T;
  viewportPositionTo<T extends Vector2Like>(out: T): T;
  worldPositionTo<T extends Vector2Like>(out: T): T;
  viewportDeltaTo<T extends Vector2Like>(
    out: T,
    normalizeWithSize?: boolean
  ): T;
}
```

`position` uses canvas-local CSS pixels. Mousemove reads `offsetX` and
`offsetY` when present, then falls back to `getBoundingClientRect()`. A drag
continues to update when the pointer leaves the canvas and releases when the
document receives mouseup.

`delta` is the change in canvas pixels published by the latest update.
`viewportPosition` normalizes position into `[-1, 1]` on both axes and flips
Y. `worldPosition` scales that value by half the canvas size, producing
centered pixel coordinates.

`viewportDelta()` flips Y. Passing `true` also divides X and Y by half of the
matching canvas dimension. The property getters and `viewportDelta()` return
new objects. The `*To()` methods write into a caller-owned object such as a
`THREE.Vector2` and return the same object.

`Vector2Like` is the structural `{ x: number; y: number }` shape used by these
methods. It is not exported from the package root.

`newPosition` and `newDelta` are public in the current declaration but are
staging objects written by DOM handlers before `update()`. Polling consumers
should use `position` and `delta`.

## Wheel input

```ts
interface Mouse {
  readonly scroll: { x: number; y: number };
  readonly scrollUp: boolean;
  readonly scrollDown: boolean;

  scrollTo<T extends Vector2Like>(out: T): T;
}

declare class Mouse {
  static wheelDelta(
    event: WheelEvent
  ): [number, number];
}
```

`scroll` contains signed wheel notches for the current update. Positive Y
means scrolling away from the user. Several wheel events in one update are
summed, including horizontal input and magnitude. `scrollTo()` writes the same
state into a caller-owned object.

`wheelDelta()` normalizes browser wheel events into `[x, y]` notches. The
current `MouseEvents` declaration types the `wheel` listener argument as
`MouseEvent`, although browsers deliver a `WheelEvent`; callers passing that
argument to `wheelDelta()` need to narrow or cast it.

## Pointer lock and visibility

```ts
interface Mouse {
  readonly locked: boolean;
  visible: boolean;

  lock(): void;
  unlock(): void;
}
```

`lock()` records pointer-lock intent. The canvas requests pointer lock on the
next mouse down; calling `lock()` does not request it immediately. Movement
then comes from `movementX` and `movementY` while lock is active.

`unlock()` clears pending intent and exits pointer lock when the canvas owns
it. `visible = false` sets the canvas cursor to `"none"`; `true` sets it to
`"auto"`.

## Touch synchronization

```ts
synchronizeWithTouch(
  touch: Touch,
  buttonValue?: boolean,
  position?: TouchPosition
): void
```

Mirrors the primary touch into the left mouse button and mouse position.
Touches with another identifier are ignored. `Input` wires this method to its
`Touchpad` automatically.

## Events

```ts
type MouseEvents = {
  lockStateChange: (state: MouseLockState) => void;
  down: (event: MouseEvent) => void;
  up: (event: MouseEvent) => void;
  move: (event: MouseEvent) => void;
  wheel: (event: MouseEvent) => void;
};
```

Down, move, double-click, and wheel handlers prevent their browser defaults.
Mouse down also focuses the canvas. A held drag continues to emit `move` and
`up` from document events outside the canvas.

`lockStateChange` fires only when the tracked lock state changes or an active
lock reports an error.

## Lifecycle

```ts
connect(): void
disconnect(): void
```

`connect()` registers canvas and document listeners. `disconnect()` removes
them. It does not reset the published state.
