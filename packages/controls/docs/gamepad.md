# Gamepad

Gamepad input handler supporting up to 4 controllers. Tracks button state,
analog stick axes with dead zone, and axis auto-repeat for menu navigation.

Automatically connected and polled by `Input`, but can also be used standalone.

```ts
import {
  Gamepad,
  GamepadButton,
  GamepadAxis
} from "@jolly-pixel/controls";

const gamepad = new Gamepad();

gamepad.connect();
gamepad.on("connect", (pad) => console.log("connected", pad.id));

function gameLoop() {
  gamepad.update();

  if (gamepad.buttons[0][GamepadButton.A].wasJustPressed) {
    console.log("Player 1 pressed A!");
  }

  const stickX = gamepad.axes[0][GamepadAxis.LeftStickX].value;
  if (stickX !== 0) {
    console.log("Left stick X:", stickX);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Constructor

### `new Gamepad(options?)`

```ts
interface GamepadOptions {
  navigatorAdapter?: NavigatorAdapter;
  windowAdapter?: WindowAdapter;
}

new Gamepad(options?: GamepadOptions);
```

## Types

```ts
type GamepadIndex = 0 | 1 | 2 | 3;

// W3C Standard Gamepad button mapping
// @see https://w3c.github.io/gamepad/#remapping
const GamepadButton = {
  // Face buttons
  A: 0,        // Xbox: A, PlayStation: Cross
  B: 1,        // Xbox: B, PlayStation: Circle
  X: 2,        // Xbox: X, PlayStation: Square
  Y: 3,        // Xbox: Y, PlayStation: Triangle
  // Shoulder buttons
  LeftBumper: 4,   // L1
  RightBumper: 5,  // R1
  LeftTrigger: 6,  // L2
  RightTrigger: 7, // R2
  // Center buttons
  Select: 8,       // Back/Share
  Start: 9,        // Start/Options
  // Stick buttons
  LeftStick: 10,   // L3
  RightStick: 11,  // R3
  // D-Pad
  DPadUp: 12,
  DPadDown: 13,
  DPadLeft: 14,
  DPadRight: 15,
  // Special
  Home: 16
} as const;

// Axis values range from -1.0 (left/up) to 1.0 (right/down)
const GamepadAxis = {
  LeftStickX: 0,
  LeftStickY: 1,
  RightStickX: 2,
  RightStickY: 3
} as const;

interface GamepadButtonState {
  isDown: boolean;
  wasJustPressed: boolean;
  wasJustReleased: boolean;
  value: number;
}

interface GamepadAxisState {
  wasPositiveJustPressed: boolean;
  wasPositiveJustAutoRepeated: boolean;
  wasPositiveJustReleased: boolean;
  wasNegativeJustPressed: boolean;
  wasNegativeJustAutoRepeated: boolean;
  wasNegativeJustReleased: boolean;
  value: number;
}

interface GamepadAutoRepeat {
  axis: number;
  positive: boolean;
  time: number;
}
```

## Events

```ts
type GamepadEvents = {
  connect: [gamepad: globalThis.Gamepad];
  disconnect: [gamepad: globalThis.Gamepad];
};
```

## Properties

```ts
interface Gamepad {
  static readonly MaxGamepads: 4;
  static readonly MaxButtons: 16;
  static readonly MaxAxes: 4;

  // Per-gamepad, per-button state
  buttons: GamepadButtonState[][];
  // Per-gamepad, per-axis state
  axes: GamepadAxisState[][];
  // Per-gamepad auto-repeat tracking (for held axes)
  autoRepeats: (GamepadAutoRepeat | null)[];

  // Number of currently connected controllers
  connectedGamepads: number;

  // Dead zone threshold for analog sticks (default 0.25)
  axisDeadZone: number;
  // Delay before first auto-repeat in ms (default 500)
  axisAutoRepeatDelayMs: number;
  // Interval between auto-repeats in ms (default 33)
  axisAutoRepeatRateMs: number;

  readonly wasActive: boolean;
}
```

## API

```ts
interface Gamepad {
  // Lifecycle
  connect(): void;
  disconnect(): void;
  reset(): void;
  update(): void;

  // Per-frame state queries, `buttonIndex` accepts a GamepadButton name or index
  isButtonDown(gamepad: GamepadIndex, buttonIndex: number | keyof typeof GamepadButton): boolean;
  wasButtonJustPressed(gamepad: GamepadIndex, buttonIndex: number | keyof typeof GamepadButton): boolean;
  wasButtonJustReleased(gamepad: GamepadIndex, buttonIndex: number | keyof typeof GamepadButton): boolean;
  // Analog value of a button (0 to 1)
  getButtonValue(gamepad: GamepadIndex, buttonIndex: number | keyof typeof GamepadButton): number;

  // `axis` accepts a GamepadAxis name or index; throws on an out-of-range gamepad/axis
  wasAxisJustPressed(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis,
    options?: { positive?: boolean; autoRepeat?: boolean; }
  ): boolean;
  wasAxisJustReleased(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis,
    options?: { positive?: boolean; }
  ): boolean;
  // Current axis value (-1 to 1)
  getAxisValue(gamepad: GamepadIndex, axis: number | keyof typeof GamepadAxis): number;
}
```

`isButtonDown`/`wasButtonJustPressed`/`wasButtonJustReleased`/`getButtonValue`/`wasAxisJustPressed`/
`wasAxisJustReleased`/`getAxisValue` all throw `Error("Invalid gamepad info")` for an out-of-range
gamepad index, button, or axis — unlike `Mouse`/`Keyboard`, there's no `"ANY"`/`"NONE"` sentinel here.
