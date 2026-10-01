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

## Suspension

```ts
get suspended(): boolean
suspend(): () => void
```

`suspend()` stops the keyboard the same way as `enabled = false` without
changing `enabled`. It returns a release function; extra calls to the same
release do nothing. The keyboard stays suspended until every suspension is
released, so several owners can hold it at once.

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

## Guards

```ts
interface KeyboardGuard {
  blocks(event: KeyboardEvent): boolean;
  onEngage?(listener: () => void): () => void;
}

addGuard(guard: KeyboardGuard): () => void
```

A guard lets another input owner, such as an open UI dialog, take keys away
from the keyboard. A keydown or keypress that any guard `blocks()` is ignored
the same way as an editable target: no event, no state change. Keyup is never
guarded.

`onEngage` is optional. When the guard calls its listener, held keys are
released, so the next `update()` publishes `wasJustReleased` for them.
Tracked states in `buttons` are kept.

`addGuard()` returns a disposer that removes the guard and its engage
subscription. Adding the same guard twice registers it once.

```ts
import { inputLayers } from "@jolly-pixel/ui";

const dispose = input.keyboard.addGuard(inputLayers);
```

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

## Bindings

```ts
type KeyBindingHandler = (event: KeyboardEvent) => boolean | void;

interface KeyBindingOptions {
  repeat?: boolean;
  priority?: number;
}

bind(
  chords: KeyChordString | readonly KeyChordString[],
  handler: KeyBindingHandler,
  options?: KeyBindingOptions
): () => void
```

`bind()` runs `handler` on a keydown that matches one of `chords`. It returns
a function that removes the binding.

```ts
keyboard.bind(["Mod+KeyY", "Mod+Shift+KeyZ"], () => history.redo());
keyboard.bind("BracketLeft", () => brush.resize(-1), { repeat: true });
keyboard.bind("Escape", () => placement.cancel(), { priority: 1 });
```

- Auto-repeated keydowns are skipped unless `repeat` is `true`.
- Bindings on the same key run from the highest `priority` (default `0`) to
  the lowest, in registration order for equal priorities.
- A handler that returns `false` passes the key to the next binding. Any other
  return value handles it: no later binding runs and the event gets
  `preventDefault()`.
- Bindings listen to the key event named after `event.code`, so they follow
  the same enabled, suspension, guard, and editable-target rules.

## Key chords

```ts
type KeyChordString = `${"" | "Mod+" | "Shift+" | "Alt+" | ...}${KeyCode}`;

class KeyChord {
  static parse(chord: KeyChordString): KeyChord;

  constructor(options: { code: KeyCode; mod?: boolean; shift?: boolean; alt?: boolean; });

  readonly code: KeyCode;
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;

  matches(event: KeyChordEvent, options?: { apple?: boolean; }): boolean;
  format(options?: { apple?: boolean; }): string;
}
```

A chord string lists its modifiers in the order `Mod`, `Shift`, `Alt`,
then a physical `KeyCode`, such as `"Mod+Shift+KeyZ"`. `Mod` is Meta on
Apple platforms and Control elsewhere.

`matches()` compares `event.code` and requires the exact modifier set:
`"KeyG"` rejects Shift+G, and `"Mod+KeyZ"` rejects Ctrl+Z on Apple
platforms.

`format()` returns a label for tooltips: `"Ctrl+Shift+Z"`, or `"⇧⌘Z"` on
Apple platforms. Letter and digit codes print their character, and some
codes print a short name (`"Esc"`, `"["`, `"↑"`). The label names the key
on a QWERTY layout.

`apple` defaults to `isApplePlatform()`.

## Lifecycle

```ts
connect(): void
disconnect(): void
```

`connect()` registers keydown, keypress, and keyup listeners on the document
adapter. `disconnect()` removes those listeners. Resetting state does not
disconnect the device.
