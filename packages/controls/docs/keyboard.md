# Keyboard

`Keyboard` tracks physical key state, auto-repeat, and printable characters.
`Input` connects and updates one automatically, or the device can be used on
its own.

```ts
import { Keyboard } from "@jolly-pixel/controls";

const keyboard = new Keyboard();
keyboard.connect();

function gameLoop() {
  keyboard.update();

  if (keyboard.wasJustPressed("Space")) {
    console.log("Space pressed!");
  }
  if (keyboard.char !== "") {
    console.log("Typed:", keyboard.char);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Constructor

```ts
interface KeyboardOptions {
  documentAdapter?: DocumentAdapter;
}

new Keyboard(options?: KeyboardOptions)
```

The document adapter defaults to `BrowserDocumentAdapter`. The adapter type is
referenced by the public option but is not exported from the package root.

## Types

```ts
interface KeyState {
  code: string;
  isDown: boolean;
  wasJustPressed: boolean;
  wasJustAutoRepeated: boolean;
  wasJustReleased: boolean;
}

type InputKeyboardAction = ExtendedKeyCode | "ANY" | "NONE";
```

`KeyCode` is the exported union of supported physical `KeyboardEvent.code`
values, including `"KeyA"`, `"Space"`, and `"ArrowUp"`. `ExtendedKeyCode`
also accepts one-character alphabetic and numeric shorthands. For example,
`"A"`, `"a"`, and `"KeyA"` all query the same physical key.

## Frame state

```ts
interface Keyboard {
  buttons: Map<string, KeyState>;
  buttonsDown: Set<string>;
  autoRepeatedCode: string | null;
  char: string;
  newChar: string;
  readonly wasActive: boolean;

  update(): void;
  reset(): void;
}
```

`buttonsDown` changes as DOM events arrive. `update()` compares it with the
previous frame and publishes the `KeyState` transition flags in `buttons`.
Each just-pressed, just-released, and auto-repeat flag lasts for one update.

`char` contains all printable characters received since the previous update.
It becomes an empty string on the next update if no new characters arrived.
`wasActive` is `true` while a key is held or an auto-repeat is published.
A release-only update publishes `wasJustReleased` with `wasActive` set to
`false`.

`reset()` clears held keys, character input, and all tracked key states.

`buttons`, `buttonsDown`, `autoRepeatedCode`, and `newChar` are public fields in
the current declaration. The query methods and `char` are the stable polling
surface; `autoRepeatedCode` and `newChar` are staging state used by
`update()`.

## Queries

```ts
interface Keyboard {
  isDown(key: InputKeyboardAction): boolean;
  wasJustPressed(key: InputKeyboardAction): boolean;
  wasJustReleased(key: InputKeyboardAction): boolean;
  wasJustAutoRepeated(key: ExtendedKeyCode): boolean;
}
```

`isDown()` reads the held state. The `wasJust*` methods read the transition
published by the latest update. Unknown tracked states return `false`.

`"ANY"` returns whether at least one key matches the query. `"NONE"` returns
the inverse. `wasJustAutoRepeated()` requires a specific key and does not
accept either sentinel.

## Enabled state

```ts
get enabled(): boolean
set enabled(value: boolean)
```

The keyboard starts enabled. Setting `enabled` to `false` resets all held and
pending state, then ignores keydown, keyup, and keypress events. Setting it
back to `true` resumes event tracking without reconnecting listeners.

## Editable elements and browser defaults

Keydown and keypress events are ignored when their composed path contains an
`input`, `textarea`, or content-editable element. Keyup is still handled so a
key pressed outside an editor cannot remain held after focus moves into it.

Arrow keys, Page Up/Down, Home/End, Insert/Delete, and F1 through F24 call
`preventDefault()`. Tab and Escape keep their browser behavior.

The package also exports the same composed-path check:

```ts
interface KeyEventTargetLike {
  target?: unknown;
  composedPath?: () => readonly unknown[];
}

function isEditableTarget(
  event: KeyEventTargetLike
): boolean
```

`isEditableTarget()` prefers `composedPath()` when present, which handles
events retargeted through shadow DOM. It falls back to `target` for synthetic
events without a composed path.

## Events

```ts
type KeyboardEvents =
  & Record<KeyCode, (event: KeyboardEvent) => void>
  & {
    down: (event: KeyboardEvent) => void;
    up: (event: KeyboardEvent) => void;
    press: (event: KeyboardEvent) => void;
  };
```

`down` fires for every accepted keydown, including browser auto-repeat. `up`
fires for accepted keyup events. `press` fires only when `event.key` is one
printable character with a character code of at least 32.

A keydown also emits an event named after `event.code`, such as `"Space"` or
`"KeyA"`.

## Lifecycle

```ts
connect(): void
disconnect(): void
```

`connect()` registers keydown, keypress, and keyup listeners on the document
adapter. `disconnect()` removes those listeners. Resetting state does not
disconnect the device.
