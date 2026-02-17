# Mouse

Low-level mouse device. Tracks button state, position, movement delta,
scroll wheel, pointer lock, and double-click.

Automatically connected and polled by `Input`, but can also be used standalone.

```ts
import {
  Mouse,
  MouseEventButton
  } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const mouse = new Mouse({ canvas });

mouse.connect();
mouse.on("down", (event) => console.log("button", event.button));
mouse.on("wheel", (event) => {
  const [dx, dy] = Mouse.getWheelDelta(event);
  console.log("scroll", dx, dy);
});

function gameLoop() {
  mouse.update();

  if (mouse.buttons[MouseEventButton.left].wasJustPressed) {
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
  doubleClicked: boolean;
  wasJustPressed: boolean;
  wasJustReleased: boolean;
}
```

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
  // Per-button state indexed by MouseEventButton values
  buttons: MouseButtonState[];
  // Raw down state, written immediately on DOM events
  buttonsDown: boolean[];

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

  // Mirror primary touch into mouse state (left button + position)
  synchronizeWithTouch(
    touch: Touch,
    buttonValue?: boolean,
    position?: TouchPosition
  ): void;
}

// Normalize WheelEvent across browsers and platforms
static getWheelDelta(event: WheelEvent): [number, number];
```
