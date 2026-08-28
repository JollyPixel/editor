# Gamepad

`Gamepad` polls up to four controllers through the browser Gamepad API. It
tracks button transitions, analog values, directional stick transitions, and
axis auto-repeat for menu-style navigation.

`Input` connects and updates one automatically, or the device can be used on
its own.

```ts
import {
  Gamepad,
  GamepadAxis,
  GamepadButton
} from "@jolly-pixel/controls";

const gamepad = new Gamepad();
gamepad.connect();

function gameLoop() {
  gamepad.update();

  if (gamepad.wasButtonJustPressed(0, GamepadButton.A)) {
    console.log("Player 1 pressed A");
  }

  const stickX = gamepad.axisValue(0, GamepadAxis.LeftStickX);
  if (stickX !== 0) {
    console.log("Left stick X:", stickX);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Constructor

```ts
interface GamepadOptions {
  navigatorAdapter?: NavigatorAdapter;
  windowAdapter?: WindowAdapter;
}

new Gamepad(options?: GamepadOptions)
```

The adapters default to browser-backed implementations. They are useful for
custom hosts and tests, but their interfaces are not exported from the package
root.

## Standard mapping

```ts
type GamepadIndex = 0 | 1 | 2 | 3;

const GamepadButton = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LeftBumper: 4,
  RightBumper: 5,
  LeftTrigger: 6,
  RightTrigger: 7,
  Select: 8,
  Start: 9,
  LeftStick: 10,
  RightStick: 11,
  DPadUp: 12,
  DPadDown: 13,
  DPadLeft: 14,
  DPadRight: 15,
  Home: 16
} as const;

const GamepadAxis = {
  LeftStickX: 0,
  LeftStickY: 1,
  RightStickX: 2,
  RightStickY: 3
} as const;
```

The names follow the W3C standard mapping. Button availability still depends
on the connected controller.

The current implementation allocates `Gamepad.MaxButtons` as `16`, covering
indices `0` through `15`. `GamepadButton.Home` is exported as index `16`,
but no state is allocated for it, so querying `"Home"` throws
`Error("Invalid gamepad info")`.

Axis values range from `-1` to `1`. X is negative to the left and positive
to the right. Y is negative upward and positive downward.

## State

```ts
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

declare class Gamepad {
  static MaxGamepads: number;
  static MaxButtons: number;
  static MaxAxes: number;
  static IdlePollFrames: number;

  connectedGamepads: number;
  buttons: GamepadButtonState[][];
  axes: GamepadAxisState[][];
  autoRepeats: (GamepadAutoRepeat | null)[];
  vibration: GamepadVibration[];

  axisDeadZone: number;
  axisAutoRepeatDelayMs: number;
  axisAutoRepeatRateMs: number;

  get wasActive(): boolean;
}
```

The arrays are indexed by gamepad first, then button or axis. They are mutable
public state. The query methods provide name resolution and consistent error
handling.

`connectedGamepads` is updated by connection events. It never drops below
zero. `wasActive` is true when the latest poll found a pressed button or an
axis beyond the directional press threshold.

The default tuning values are:

```ts
Gamepad.IdlePollFrames = 30;
gamepad.axisDeadZone = 0.25;
gamepad.axisAutoRepeatDelayMs = 500;
gamepad.axisAutoRepeatRateMs = 33;
```

All four static fields are mutable in the current declaration.

## Button queries

```ts
interface Gamepad {
  isButtonDown(
    gamepad: GamepadIndex,
    button: number | keyof typeof GamepadButton
  ): boolean;

  wasButtonJustPressed(
    gamepad: GamepadIndex,
    button: number | keyof typeof GamepadButton
  ): boolean;

  wasButtonJustReleased(
    gamepad: GamepadIndex,
    button: number | keyof typeof GamepadButton
  ): boolean;

  buttonValue(
    gamepad: GamepadIndex,
    button: number | keyof typeof GamepadButton
  ): number;
}
```

The transition methods compare the latest poll with the previous one.
`buttonValue()` returns the controller's analog button value, normally in the
range `0` through `1`.

A button index without allocated state throws
`Error("Invalid gamepad info")`. `"ANY"` and `"NONE"` are not accepted.

## Axis queries

```ts
interface Gamepad {
  wasAxisJustPressed(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis,
    options?: {
      autoRepeat?: boolean;
      positive?: boolean;
    }
  ): boolean;

  wasAxisJustReleased(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis,
    options?: {
      positive?: boolean;
    }
  ): boolean;

  axisValue(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis
  ): number;
}
```

`axisValue()` applies `axisDeadZone` to each two-axis stick using its radial
magnitude. A stick inside the dead zone reports `0` on both axes.

Directional press and release flags use a fixed magnitude of `0.5` after the
dead zone has been applied. `positive` defaults to `false`, so an omitted
option queries the negative direction. Set `positive: true` for right or down.

`autoRepeat` defaults to `false`. When enabled for a press query, it also
returns true on a held direction after `axisAutoRepeatDelayMs`, then every
`axisAutoRepeatRateMs`. Auto-repeat tracks one axis direction per gamepad.

An axis index without allocated state throws
`Error("Invalid gamepad info")`.

## Polling

```ts
update(): void
reset(): void
```

Until a controller is found, `update()` calls `navigator.getGamepads()` once
every `Gamepad.IdlePollFrames` updates. This back-off still detects a
controller present at page load when `gamepadconnected` did not fire. After a
controller appears, polling returns to every update.

Set `Gamepad.IdlePollFrames = 1` for unconditional polling while disconnected.
`reset()` clears every allocated button and axis state. It leaves tuning,
connection count, and vibration wrappers in place.

## Vibration

`vibration` contains one `GamepadVibration` wrapper for each supported
gamepad index. `update()` refreshes a wrapper from the corresponding
controller's `vibrationActuator`.

```ts
interface GamepadVibrationOptions {
  startDelay?: number;
  strongMagnitude?: number;
  weakMagnitude?: number;
  effectType?: GamepadHapticEffectType;
}

declare class GamepadVibration {
  constructor(
    actuator?: GamepadHapticActuator | null
  );

  readonly canVibrate: boolean;

  pulse(
    intensity: number,
    duration: number,
    options?: GamepadVibrationOptions
  ): Promise<boolean>;

  stop(): Promise<boolean>;

  set actuator(
    actuator: GamepadHapticActuator | null
  );
}
```

`GamepadVibration` can be constructed separately with an actuator or `null`.
The `actuator` setter is marked internal and is refreshed by
`Gamepad.update()` for wrappers in the `vibration` array.

`pulse()` defaults `startDelay` to `0`, both magnitudes to `intensity`, and
`effectType` to `"dual-rumble"`. It resolves to `true` only when
`playEffect()` reports `"complete"`. It resolves to `false` when no actuator
is available or the effect is preempted.

`stop()` calls the actuator's `reset()` and follows the same boolean result
rule. It resolves to `false` when `canVibrate` is false.

```ts
if (gamepad.vibration[0].canVibrate) {
  await gamepad.vibration[0].pulse(0.75, 150);
}
```

## Events

```ts
type GamepadEvents = {
  connect: (gamepad: globalThis.Gamepad) => void;
  disconnect: (gamepad: globalThis.Gamepad) => void;
};
```

Both events receive the browser `Gamepad` from the corresponding window
event.

## Lifecycle

```ts
connect(): void
disconnect(): void
```

`connect()` registers `gamepadconnected` and `gamepaddisconnected` listeners
on the window adapter. `disconnect()` removes them. Polling happens only when
the caller invokes `update()`.
