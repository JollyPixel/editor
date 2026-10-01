# Keyboard

`Keyboard` tracks physical key state, auto-repeat, and typed characters, and
runs key-chord bindings. `Input` connects and updates one automatically, or
the device can be used on its own.

```ts
import { Keyboard } from "@jolly-pixel/controls";

const keyboard = new Keyboard();
keyboard.connect();

keyboard.bind("Mod+z", () => history.undo());

function gameLoop() {
  keyboard.update();

  if (keyboard.isDown("KeyW")) {
    player.moveForward();
  }
  if (keyboard.char !== "") {
    console.log("Typed:", keyboard.char);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Lifecycle

```ts
new Keyboard(options?: {
  documentAdapter?: DocumentAdapter;
  preventControlKeys?: boolean;
})

connect(): void
disconnect(): void
update(): void
reset(): void
```

`connect()` listens to keydown, keypress, and keyup on the document;
`disconnect()` stops. Call `update()` once per frame: it publishes the
transitions that happened since the previous call. `reset()` clears held keys
and typed characters.

## Polling

```ts
type InputKeyboardAction = ExtendedKeyCode | "ANY" | "NONE";

isDown(key: InputKeyboardAction): boolean
wasJustPressed(key: InputKeyboardAction): boolean
wasJustReleased(key: InputKeyboardAction): boolean
wasJustAutoRepeated(key: ExtendedKeyCode): boolean

char: string
readonly wasActive: boolean
```

Keys are physical `KeyboardEvent.code` values (`"KeyW"`, `"Space"`,
`"ArrowUp"`), so WASD stays a cluster on every layout. `"W"` and `"7"` are
shorthands for `"KeyW"` and `"Digit7"`; lowercase letters are rejected.

`isDown()` reads the held state. The `wasJust*` flags last for one `update()`.
`"ANY"` is true when at least one key matches, `"NONE"` when none does.

`char` holds the printable characters typed since the previous update.
`wasActive` is `true` while a key is held or auto-repeating.

## Bindings

```ts
bind(
  chords: KeyBindingChords,
  handler: (event: KeyboardEvent) => boolean | void,
  options?: { repeat?: boolean; priority?: number; }
): () => void
```

`bind()` runs `handler` on a keydown matching one of the
[key chords](./key-chords.md) and returns a function that removes the
binding. Each chord is a `KeyChordString` or a `KeyChord`.

```ts
keyboard.bind(["Mod+y", "Mod+Shift+z"], () => history.redo());
keyboard.bind("BracketLeft", () => brush.resize(-1), { repeat: true });
keyboard.bind("Escape", () => placement.cancel(), { priority: 1 });
```

- Auto-repeated keydowns are skipped unless `repeat` is `true`.
- Matching bindings run from the highest `priority` (default `0`) to the
  lowest, then in registration order.
- A handler that returns `false` passes the key on. Any other return value
  handles it: later bindings are skipped and the event gets
  `preventDefault()`.

## Pausing

```ts
enabled: boolean
readonly suspended: boolean
suspend(): () => void
```

Setting `enabled` to `false` resets the state and ignores key events until it
is `true` again. `suspend()` does the same without touching `enabled` and
returns a release function; the keyboard resumes once every suspension is
released.

## Ignored keys

Keydowns and keypresses from a text `input`, a `textarea`, or a
content-editable element are ignored, so typing in a field neither moves the player nor fires
bindings. Keyups still release held keys. The same check is exported as
`isEditableTarget(event)`.

A guard lets another owner, such as an open dialog, take keys away:

```ts
interface KeyboardGuard {
  blocks(event: KeyboardEvent): boolean;
  onEngage?(listener: () => void): () => void;
}

addGuard(guard: KeyboardGuard): () => void
```

A keydown or keypress that a guard `blocks()` is ignored like an editable
target. Calling the `onEngage` listener releases every held key.

```ts
import { inputLayers } from "@jolly-pixel/ui";

const dispose = input.keyboard.addGuard(inputLayers);
```

Arrow keys, Page Up/Down, Home/End, Insert/Delete, F1 to F24, and Alt combos
have their browser default prevented. Tab and Escape keep it. Pass
`preventControlKeys: false` to keep every browser default, for a keyboard that
only serves bindings next to other page content.

## Events

```ts
keyboard.on("down", (event) => {});
keyboard.on("up", (event) => {});
keyboard.on("press", (event) => {});
keyboard.on("KeyA", (event) => {});
```

`down` fires for every accepted keydown, auto-repeat included, followed by
the event named after its `event.code`. `press` fires for each printable
character, and `up` for each keyup.
