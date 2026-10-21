# KeyBindingMap

A `KeyBindingMap` names the keyboard shortcuts of one feature by action, such as
`undo` or `rotate`, so users can rebind them. It merges default
[key chords](./key-chords.md) with user overrides, rejects a chord bound to two
actions, and binds every action on a [`Keyboard`](./keyboard.md#bindings) at
once.

```ts
import {
  Keyboard,
  KeyBindingMap
} from "@jolly-pixel/controls";

const keyboard = new Keyboard();
keyboard.connect();

const shortcuts = new KeyBindingMap({
  undo: "Mod+z",
  redo: ["Mod+y", "Mod+Shift+z"],
  remove: "Delete"
}, {
  redo: "Mod+Shift+y"
});

const release = shortcuts.bind(keyboard, {
  undo: () => history.undo(),
  redo: () => history.redo(),
  remove: () => selection.remove()
});

shortcuts.format("redo"); // ["Ctrl+Shift+Y"]
```

## Constructor

```ts
new KeyBindingMap<TAction extends string>(
  defaults: KeyBindingDefaults<TAction>,
  overrides?: KeyBindingOverrides<TAction>
)

type KeyBindingDefaults<TAction extends string> = Readonly<
  Record<TAction, KeyChordString | readonly KeyChordString[]>
>;
type KeyBindingOverrides<TAction extends string> = Partial<
  Record<TAction, string | readonly string[]>
>;
```

The keys of `defaults` are the actions, in declaration order. Defaults are
typed chords, checked at compile time. Overrides are plain strings, because
they usually come from storage or user input.

An override replaces every default chord of its action. An empty list leaves
the action unbound. An override for a name that is not in `defaults` is
ignored.

The map is immutable. When the overrides change, build a new map and bind it
in place of the old one.

### Errors

The constructor throws:

| Error | When | Fields |
|---|---|---|
| `InvalidKeyChordError` | an override is not a chord that [`KeyChord.from()`](./key-chords.md#keychord) reads, such as `"mod+z"` or `"Ctrl+z"` | `chord` |
| `KeyChordConflictError` | one chord belongs to two actions | `chord`, `actions` (the earlier action first) |

Chords conflict when their modifiers and their target are the same. A letter
chord (`"Mod+z"`) and a code chord (`"Mod+KeyZ"`) never conflict, even when the
current layout prints Z on that key. Listing a chord twice for the same action
is not a conflict.

## Members

```ts
readonly actions: readonly TAction[];
get overrides(): Partial<Record<TAction, KeyChordString[]>>;

chordsBoundTo(action: TAction): readonly KeyChord[];
format(action: TAction, options?: KeyChordFormatOptions): string[];
rebind(
  action: TAction,
  chords: string | readonly string[]
): KeyBindingMap<TAction>;
restore(action?: TAction): KeyBindingMap<TAction>;
toJSON(): Partial<Record<TAction, KeyChordString[]>>;
bind(
  target: KeyBindingTarget,
  handlers: Partial<KeyBindingHandlers<TAction>>,
  options?: KeyBindingOptions
): () => void;

interface KeyBindingTarget {
  bind(
    chords: KeyBindingChords,
    handler: KeyBindingHandler,
    options?: KeyBindingOptions
  ): () => void;
}
type KeyBindingHandlers<TAction extends string> = Readonly<
  Record<TAction, KeyBindingHandler>
>;
```

`overrides` lists, in canonical form, the chords of every action that differ
from its defaults. It returns a new object on each read. A map built from the
same defaults and these overrides has the same chords, so store this value.

`chordsBoundTo()` returns the resolved chords of an action, after overrides.

`format()` labels each chord of an action for a tooltip or a settings screen,
with the same options as [`KeyChord.format()`](./key-chords.md#labels).

`rebind()` returns a new map where `chords` replace the chords of `action`, and
`restore()` returns one where `action`, or every action when it is omitted, is
back to its defaults. Both keep the other overrides, leave the source map
unchanged, and throw the constructor errors.

`toJSON()` returns `overrides`, so `JSON.stringify(map)` gives the value to
store.

`bind()` registers one binding per action that has a handler, on a `Keyboard`
or a [`KeyBindings`](./key-chords.md#keybindings) registry, with the same
`repeat` and `priority` options for every action. An action without a handler
stays unbound, so several `bind()` calls can split the actions by option, or
give one action a second handler. A handler that returns `false` passes the key on to the
next matching binding and keeps the browser default. `bind()` returns one
function that removes every binding it made.

## Parsing stored overrides

```ts
static parse<TAction extends string>(
  defaults: KeyBindingDefaults<TAction>,
  json: string
): ParsedKeyBindings<TAction>;
static from<TAction extends string>(
  defaults: KeyBindingDefaults<TAction>,
  stored: unknown
): ParsedKeyBindings<TAction>;

interface ParsedKeyBindings<TAction extends string> {
  keyBindings: KeyBindingMap<TAction>;
  dropped: string[];
}
```

`parse()` reads a stored `JSON.stringify(map)` value, and `from()` reads the
already parsed object. Neither throws. A set of overrides that builds a valid
map is taken whole, so two actions can trade chords. Otherwise each entry is
applied in order, and one that names an unknown action, is not a string or a
list of strings, or makes the constructor throw is dropped. `dropped` holds
one message per dropped entry, such as
`Dropped the stored keybinding "jump": unknown action`. A value that is not a
JSON object drops every entry with a single message.

## Rebinding

Build the next map before releasing the old bindings, so a rejected chord
leaves the previous shortcuts in place:

```ts
let map = KeyBindingMap.parse(DEFAULTS, stored).keyBindings;
let release = map.bind(keyboard, handlers);

function rebind(action: Action, chords: readonly string[]): void {
  const next = map.rebind(action, chords);

  release();
  map = next;
  release = map.bind(keyboard, handlers);
  storage.set(key, JSON.stringify(map));
}
```

[`KeyBindingSettings`](./key-binding-settings.md) holds the current map and
emits each new one, and its `bind()` does this rebinding for you.

`KEY_CODES` lists every key code a chord accepts, for a settings screen that
offers them, and `isKeyCode(value)` narrows a string to one of them.
`MODIFIER_KEY_CODES` gives the left and right codes of each `ModifierKey`
(`Shift`, `Control`, `Alt`, `Meta`), so a binding recorded from one side can
hold both.

```ts
isKeyCode("KeyW"); // true
MODIFIER_KEY_CODES.Shift; // ["ShiftLeft", "ShiftRight"]
```
