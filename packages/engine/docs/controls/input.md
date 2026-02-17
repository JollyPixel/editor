# Input

Unified input manager that aggregates mouse, keyboard, gamepad, and touchpad
into a single high-level API. Handles device detection, preference switching,
pointer locking, fullscreen, and provides per-frame state queries
(is down, just pressed, just released).

```ts
import { Input } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const input = new Input(canvas);

input.connect();

function gameLoop() {
  input.update();

  if (input.wasKeyJustPressed("Space")) {
    console.log("Jump!");
  }
  if (input.isMouseButtonDown("left")) {
    const delta = input.getMouseDelta(true);
    console.log("Dragging", delta.x, delta.y);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Device APIs

Each device is available as a property on the `Input` instance
(`input.mouse`, `input.keyboard`, `input.gamepad`, `input.touchpad`,
`input.screen`) and can also be used standalone.

- [Mouse](mouse.md)
- [Keyboard](keyboard.md)
- [Gamepad](gamepad.md)
- [Touchpad](touchpad.md)
- [Screen](screen.md)

## Constructor

### `new Input(canvas, options?)`

```ts
interface InputOptions {
  // Emit an "exit" event on window.onbeforeunload
  enableOnExit?: boolean;
  // Custom window adapter (defaults to BrowserWindowAdapter)
  windowAdapter?: WindowAdapter;
}

new Input(canvas: HTMLCanvasElement, options?: InputOptions);
```

## Lifecycle

### `connect()`

Register all DOM event listeners for every device (mouse, keyboard,
gamepad, touchpad, screen). Must be called before `update()`.

### `disconnect()`

Remove all DOM event listeners. Call when tearing down the game loop.

### `update()`

Poll every device and flush per-frame state (just pressed / just released).
Call once per frame **before** querying input state.

## Events

`Input` extends `EventEmitter` and emits the following events:

```ts
type InputDevicePreference = "default" | "gamepad";

type InputEvents = {
  // Fired on window.onbeforeunload (requires enableOnExit)
  exit: [];
  // Fired when active device switches between "default" (mouse + keyboard) and "gamepad"
  devicePreferenceChange: [preference: InputDevicePreference];
};
```

## Decorator

### `Input.listen(type)`

Method decorator that registers a behavior method as a listener for an
input event. Used with `reflect-metadata`.

```ts
class PlayerBehavior {
  @Input.listen("keyboard.down")
  onKeyDown() {
    // ...
  }
}
```

Available listener types:

- `mouse.down`
- `mouse.up`
- `mouse.move`
- `mouse.wheel`
- `mouse.lockStateChange`
- `keyboard.down`
- `keyboard.up`
- `keyboard.press`
- `keyboard.<KeyCode>`
- `gamepad.connect`
- `gamepad.disconnect`
- `touchpad.start`
- `touchpad.move`
- `touchpad.end`
- `screen.stateChange`
- `input.devicePreferenceChange`
- `input.exit`

## Screen

### `enterFullscreen()`

Request fullscreen on the canvas element.

### `exitFullscreen()`

Exit fullscreen mode.

### `getScreenSize(): Vector2`

Returns canvas client dimensions as a `THREE.Vector2`.

### `getScreenBounds(): { left, right, top, bottom }`

Returns screen bounds centered at origin (useful for orthographic cameras).

## Mouse

### `getMousePosition(): Vector2`

Returns mouse position normalized to `[-1, 1]` on both axes.

### `getMouseWorldPosition(): Vector2`

Returns mouse position in world-space pixels, centered at origin.

### `getMouseDelta(normalizeWithSize?): Vector2`

Returns mouse movement delta since last frame.
When `normalizeWithSize` is `true`, the delta is divided by half the canvas
dimensions.

### `isMouseMoving(): boolean`

Returns `true` if the mouse moved during the current frame.

### `isMouseButtonDown(action): boolean`

Returns `true` while the given button is held.

### `wasMouseButtonJustPressed(action): boolean`

Returns `true` only on the frame the button was pressed.

### `wasMouseButtonJustReleased(action): boolean`

Returns `true` only on the frame the button was released.

### `lockMouse()` / `unlockMouse()`

Request or release pointer lock on the canvas.

### `getMouseVisible(): boolean` / `setMouseVisible(visible)`

Get or set cursor visibility.

```ts
type InputMouseAction =
  | "left" | "middle" | "right" | "back" | "forward"
  | number
  | "ANY" | "NONE";
```

## Keyboard

### `isKeyDown(key): boolean`

Returns `true` while the key is held.

### `wasKeyJustPressed(key): boolean`

Returns `true` only on the frame the key was pressed.

### `wasKeyJustReleased(key): boolean`

Returns `true` only on the frame the key was released.

### `wasKeyJustAutoRepeated(key): boolean`

Returns `true` on auto-repeat frames (held key).

### `getTextEntered(): string`

Returns the character typed during the current frame (if any).

```ts
type InputKeyboardAction = KeyCode | "ANY" | "NONE";
```

## Touchpad

### `isTouchDown(index): boolean`

Returns `true` while the touch point is active.

### `wasTouchStarted(index): boolean`

Returns `true` on the frame the touch began.

### `wasTouchEnded(index): boolean`

Returns `true` on the frame the touch ended.

### `getTouchPosition(index): Vector2`

Returns touch position normalized to `[-1, 1]`.

### `isTouchpadAvailable(): boolean`

Returns `true` if the device supports touch events.

## Gamepad

### `isGamepadButtonDown(gamepad, button): boolean`

Returns `true` while the button is held.

### `wasGamepadButtonJustPressed(gamepad, button): boolean`

Returns `true` only on the frame the button was pressed.

### `wasGamepadButtonJustReleased(gamepad, button): boolean`

Returns `true` only on the frame the button was released.

### `getGamepadButtonValue(gamepad, button): number`

Returns the analog value of a button (`0` to `1`).

### `getGamepadAxisValue(gamepad, axis): number`

Returns the current axis value (`-1` to `1`).

### `wasGamepadAxisJustPressed(gamepad, axis, options?): boolean`

Returns `true` when an axis crosses the dead zone threshold.

```ts
interface GamepadAxisPressOptions {
  // Check positive direction instead of negative
  positive?: boolean;
  // Include auto-repeat frames
  autoRepeat?: boolean;
}
```

### `wasGamepadAxisJustReleased(gamepad, axis, options?): boolean`

Returns `true` when an axis returns inside the dead zone.

### `setGamepadAxisDeadZone(deadZone)` / `getGamepadAxisDeadZone(): number`

Set or get the dead zone threshold for all axes.

```ts
type GamepadIndex = 0 | 1 | 2 | 3;

type GamepadButton =
  | "A" | "B" | "X" | "Y"
  | "LeftBumper" | "RightBumper" | "LeftTrigger" | "RightTrigger"
  | "Select" | "Start"
  | "LeftStick" | "RightStick"
  | "DPadUp" | "DPadDown" | "DPadLeft" | "DPadRight"
  | "Home"
  | number;

type GamepadAxis =
  | "LeftStickX" | "LeftStickY"
  | "RightStickX" | "RightStickY"
  | number;
```

## Misc

### `vibrate(pattern)`

Trigger device vibration via `navigator.vibrate()`.

### `getDevicePreference(): InputDevicePreference`

Returns `"default"` (mouse + keyboard) or `"gamepad"` based on which device
was last active.
