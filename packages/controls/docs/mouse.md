# Mouse

Low-level mouse device. Tracks button state, position, movement delta,
scroll wheel, pointer lock, and double-click.

Automatically connected and polled by `Input`, but can also be used standalone.

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
mouse.on("down", (event) => console.log("button", event.button));
mouse.on("wheel", (event) => {
  const [dx, dy] = Mouse.wheelDelta(event);
  console.log("scroll", dx, dy);
});

function gameLoop() {
  mouse.update();

  if (mouse.wasJustPressed(MouseEventButton.left)) {
    console.log("Left click!");
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Constructor

### `new Mouse(options)`

```ts
interface MouseOptions {
  canvas: CanvasAdapter;
  // Custom document adapter (defaults to BrowserDocumentAdapter)
  documentAdapter?: DocumentAdapter;
}

new Mouse(options: MouseOptions);
```

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

type MouseLockState = "locked" | "unlocked";

interface MouseButtonState {
  isDown: boolean;
  // One-frame pulse, like wasJustPressed/wasJustReleased: set by the tick that
  // follows the dblclick event, cleared by the next one.
  doubleClicked: boolean;
  wasJustPressed: boolean;
  wasJustReleased: boolean;
}
```

## Per-frame cost

`update()` returns immediately while the mouse is idle.

`mousemove` uses `offsetX`/`offsetY` and falls back to
`getBoundingClientRect()` when offsets are unavailable. `newPosition` reuses
one object between events.

## Events

```ts
type MouseEvents = {
  lockStateChange: [MouseLockState];
  down: [event: MouseEvent];
  up: [event: MouseEvent];
  move: [event: MouseEvent];
  wheel: [event: WheelEvent];
};
```

## Properties

```ts
interface Mouse {
  // Canvas-local position in pixels (read-only)
  readonly position: { x: number; y: number };
  // Movement delta since last update() (read-only)
  readonly delta: { x: number; y: number };

  readonly locked: boolean;
  readonly scrollUp: boolean;
  readonly scrollDown: boolean;
  readonly wasActive: boolean;
}
```

## API

```ts
interface Mouse {
  // Lifecycle
  connect(): void;
  disconnect(): void;
  reset(): void;
  update(): void;

  // Pointer lock
  lock(): void;
  unlock(): void;

  // true if the mouse moved during the current frame
  isMoving(): boolean;

  // Per-frame state queries — `action` accepts "ANY" / "NONE" alongside a
  // MouseAction / button index.
  isDown(action: InputMouseAction): boolean;
  wasJustPressed(action: InputMouseAction): boolean;
  wasJustReleased(action: InputMouseAction): boolean;

  // Snapshot of the four flags from the last update().
  // Prefer the direct queries above on per-frame paths.
  buttonState(action: number | MouseAction): Readonly<MouseButtonState>;

  // Cursor visibility (sets canvas.style.cursor)
  visible: boolean;

  // Fresh objects. Prefer the `…To` variants in per-frame code.
  // `position` normalized to [-1, 1] on both axes, Y flipped
  viewportPosition: Vector2Like;
  // `viewportPosition` scaled by half the canvas size (centered pixel coordinates)
  worldPosition: Vector2Like;
  // `delta`, Y flipped and optionally normalized against half the canvas size
  viewportDelta(normalizeWithSize?: boolean): Vector2Like;

  // Write into a caller-owned vector. `THREE.Vector2` is compatible.
  positionTo<T extends Vector2Like>(out: T): T;
  deltaTo<T extends Vector2Like>(out: T): T;
  viewportPositionTo<T extends Vector2Like>(out: T): T;
  worldPositionTo<T extends Vector2Like>(out: T): T;
  viewportDeltaTo<T extends Vector2Like>(out: T, normalizeWithSize?: boolean): T;

  // Mirror primary touch into mouse state (left button + position)
  synchronizeWithTouch(
    touch: Touch,
    buttonValue?: boolean,
    position?: TouchPosition
  ): void;
}

// Normalize WheelEvent across browsers and platforms
static wheelDelta(event: WheelEvent): [number, number];
```

```ts
type InputMouseAction = number | MouseAction | "ANY" | "NONE";
```
