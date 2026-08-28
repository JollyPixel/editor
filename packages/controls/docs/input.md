# Input

`Input` owns the mouse, keyboard, gamepad, touch, and fullscreen controls for
one canvas. It connects their browser listeners, advances their frame state,
and tracks which input family was active most recently.

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

## Constructor

```ts
interface InputOptions {
  enableOnExit?: boolean;
  windowAdapter?: WindowAdapter;
  documentAdapter?: DocumentAdapter;
}

new Input(
  canvas: CanvasAdapter,
  options?: InputOptions
)
```

An `HTMLCanvasElement` satisfies `CanvasAdapter`. The window and document
adapters default to browser-backed implementations and are mainly useful for
custom hosts and tests. Their interfaces are referenced by the public options
but are not exported from the package root.

`enableOnExit` defaults to `false`. When enabled, `Input` assigns an
`onbeforeunload` handler to the window adapter and emits `exit` once. The
assignment remains installed after `disconnect()`.

## Devices

```ts
interface Input {
  mouse: Mouse;
  keyboard: Keyboard;
  gamepad: Gamepad;
  touchpad: Touchpad;
  screen: Screen;
}
```

The device instances can also be constructed and used on their own:

- [Mouse](mouse.md)
- [Keyboard](keyboard.md)
- [Gamepad](gamepad.md)
- [Touchpad](touchpad.md)
- [Screen](screen.md)

`Input` mirrors primary touch events into the left mouse button and mouse
position. It also connects mouse down and up events to the pending fullscreen
request owned by `screen`.

## Lifecycle

```ts
interface Input {
  connect(): void;
  disconnect(): void;
  update(): void;
  publishFrameState(): void;
}
```

### `connect()` / `disconnect()`

`connect()` registers the device listeners plus window `blur` and
`contextmenu` listeners. Call it before expecting browser events to reach the
input state.

`disconnect()` removes the listeners registered by `connect()`. It does not
clear the `onbeforeunload` assignment created by `enableOnExit`.

The context-menu listener prevents the browser menu from opening. A window
blur resets mouse, keyboard, gamepad, and touch state so held controls cannot
remain stuck.

### `update()`

Advances mouse, touchpad, keyboard, and gamepad state. Call it once before the
frame reads `isDown`, `wasJustPressed`, `wasJustReleased`, movement, or typed
characters.

`update()` also changes `devicePreference` when it sees gamepad activity or
activity from mouse, keyboard, or touch input.

### `publishFrameState()`

Publishes mouse transitions, wheel state, and movement accumulated across
every `update()` call since the previous publication. A fixed-step engine can
call it before the rendered update so the render sees all transients consumed
by catch-up steps without repeating an edge.

## Device preference

```ts
type InputDevicePreference = "default" | "gamepad";

interface Input {
  get devicePreference(): InputDevicePreference;
}
```

`"default"` covers mouse, keyboard, and touch input. The initial preference is
`"default"`. `Input` changes it to `"gamepad"` after gamepad activity and back
to `"default"` after activity from one of the other devices.

## Exit state

```ts
interface Input {
  exited: boolean;
}
```

`exited` starts as `false`. The first `onbeforeunload` callback emits `exit`
and sets it to `true`; later callbacks do not emit the event again.

## Events

`Input` extends `Emitter` from `@openally/emitt`.

```ts
type InputEvents = {
  exit: () => void;
  devicePreferenceChange: (
    preference: InputDevicePreference
  ) => void;
};
```

`exit` requires `enableOnExit: true`. `devicePreferenceChange` receives the
new preference after the state changes.

## Listener types

`InputListenerType` is the dot-path union used by consumers that bind Input
and device events through one name, such as `@jolly-pixel/engine`'s
`@InputListener` decorator.

```ts
type InputListenerType =
  | "input.devicePreferenceChange"
  | "input.exit"
  | "mouse.down"
  | "mouse.up"
  | "mouse.move"
  | "mouse.wheel"
  | "mouse.lockStateChange"
  | "gamepad.connect"
  | "gamepad.disconnect"
  | "touchpad.start"
  | "touchpad.move"
  | "touchpad.end"
  | "screen.stateChange"
  | "keyboard.down"
  | "keyboard.up"
  | "keyboard.press"
  | `keyboard.${KeyCode}`;
```

## Vibration

```ts
vibrate(pattern: VibratePattern): void
```

Delegates to `navigator.vibrate()`. This is device vibration, commonly used on
phones. Controller haptics are available through
[`input.gamepad.vibration`](gamepad.md#vibration).
