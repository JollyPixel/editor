# Input

`Input` owns one instance of each input device. It connects and updates them
together and tracks device preference and exit lifecycle.

Per-device state queries (`isDown`, `wasJustPressed`, coordinate-space
helpers, ...) live on `input.mouse`, `input.keyboard`, `input.gamepad`,
`input.touchpad`, and `input.screen`.

```ts
import { Input } from "@jolly-pixel/controls";

const canvas = document.querySelector("canvas");
if (!canvas) {
  throw new Error("No canvas element found");
}
const input = new Input(canvas);

input.connect();

function gameLoop() {
  input.update();

  if (input.keyboard.wasJustPressed("Space")) {
    console.log("Jump!");
  }
  if (input.mouse.isDown("left")) {
    const delta = input.mouse.viewportDelta(true);
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
  documentAdapter?: DocumentAdapter;
}

new Input(canvas: CanvasAdapter, options?: InputOptions);
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

### `publishFrameState()`

Publish mouse transitions, wheel state, and movement accumulated across every
`update()` call since the previous publication. Engines that sample input once
per fixed step call this immediately before their rendered update, so the
rendered update sees every transient without repeating an edge in catch-up
fixed steps.

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

### `devicePreference: InputDevicePreference`

Returns `"default"` (mouse + keyboard) or `"gamepad"` based on which device
was last active.

## Listener types

`InputListenerType` contains the dot-path name of every emitted event, such as
`"mouse.down"` or `"keyboard.KeyA"`. Consumers such as
`@jolly-pixel/engine`'s `@InputListener` decorator use these names for binding.

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

## Misc

### `vibrate(pattern)`

Trigger vibration through `navigator.vibrate()`.
