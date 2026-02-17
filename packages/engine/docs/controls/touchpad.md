# Touchpad

Multi-touch input handler. Tracks up to 10 simultaneous touch points
with per-finger state (down, started, ended, position).

Automatically connected and polled by `Input`, but can also be used standalone.

```ts
import { Touchpad, TouchIdentifier } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const touchpad = new Touchpad({ canvas });

touchpad.connect();
touchpad.on("start", (touch, position) => {
  console.log("touch", touch.identifier, position);
});

function gameLoop() {
  touchpad.update();

  if (touchpad.getTouchState(TouchIdentifier.primary).wasStarted) {
    console.log("Primary finger down!");
  }
  if (touchpad.isTwoFingerGesture) {
    console.log("Pinch / two-finger gesture");
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

> [!NOTE]
> Most browsers (Chrome, Edge, Safari…) synthesize mouse events
> from touch input on desktop trackpads and treat them as pointer/mouse
> events rather than touch events. The `Touchpad` device will therefore
> only receive events on actual **touch-screen** hardware. On a laptop
> trackpad, input is handled by the `Mouse` device instead.

## Constructor

### `new Touchpad(options)`

```ts
interface TouchpadOptions {
  canvas: CanvasAdapter;
}

new Touchpad(options: TouchpadOptions);
```

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

## Events

```ts
type TouchEvents = {
  start: [Touch, TouchPosition];
  move: [Touch, TouchPosition];
  end: [Touch];
};
```

## Properties

```ts
interface Touchpad {
  static readonly MaxTouches: 10;

  // Per-finger state indexed by touch identifier
  touches: TouchState[];
  // Raw down state, written immediately on DOM events
  touchesDown: boolean[];

  readonly wasActive: boolean;
  // Gesture helpers (read-only)
  readonly isOneFingerGesture: boolean;
  readonly isTwoFingerGesture: boolean;
  readonly isThreeFingerGesture: boolean;
}
```

## API

```ts
interface Touchpad {
  // Lifecycle
  connect(): void;
  disconnect(): void;
  reset(): void;
  update(): void;

  // Returns the TouchState for a given finger identifier
  getTouchState(identifier: TouchAction): TouchState;
}
```
