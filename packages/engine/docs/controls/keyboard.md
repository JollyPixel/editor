# Keyboard

Low-level keyboard device. Tracks per-key state (down, just pressed,
just released, auto-repeat) and text input.

Automatically connected and polled by `Input`, but can also be used standalone.

```ts
import { Keyboard } from "@jolly-pixel/engine";

const keyboard = new Keyboard();

keyboard.connect();
keyboard.on("down", (event) => console.log("key", event.code));

function gameLoop() {
  keyboard.update();

  const spaceState = keyboard.buttons.get("Space");
  if (spaceState?.wasJustPressed) {
    console.log("Space pressed!");
  }

  const typed = keyboard.char;
  if (typed) {
    console.log("Typed:", typed);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Constructor

### `new Keyboard(options?)`

```ts
interface KeyboardOptions {
  // Custom document adapter (defaults to BrowserDocumentAdapter)
  documentAdapter?: DocumentAdapter;
}

new Keyboard(options?: KeyboardOptions);
```

## Types

```ts
interface KeyState {
  isDown: boolean;
  wasJustPressed: boolean;
  wasJustAutoRepeated: boolean;
  wasJustReleased: boolean;
}

// KeyCode is the physical key code (e.g. "KeyA", "Space", "ArrowUp")
// ExtendedKeyCode adds modifier-aware aliases
type KeyCode = string;
type ExtendedKeyCode = string;
```

## Events

```ts
type KeyboardEvents = {
  down: [event: KeyboardEvent];
  up: [event: KeyboardEvent];
  // Fired for printable characters (charCode >= 32)
  press: [event: KeyboardEvent];
  // Per-key event using event.code (e.g. "Space", "KeyA")
  [key: string]: [event: KeyboardEvent];
};
```

## Properties

```ts
interface Keyboard {
  // Per-key state keyed by event.code
  buttons: Map<string, KeyState>;
  // Currently held keys
  buttonsDown: Set<string>;
  // Characters typed during the current frame
  char: string;

  readonly wasActive: boolean;
}
```

## API

```ts
interface Keyboard {
  // Lifecycle
  connect(): void;
  disconnect(): void;
  reset(): void;
  update(): void;
}
```
