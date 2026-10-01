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

chordsOf(action: TAction): readonly KeyChord[];
format(action: TAction, options?: KeyChordFormatOptions): string[];
bind(
  target: KeyBindingTarget,
  handlers: KeyBindingHandlers<TAction>,
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

`chordsOf()` returns the resolved chords of an action, after overrides.

`format()` labels each chord of an action for a tooltip or a settings screen,
with the same options as [`KeyChord.format()`](./key-chords.md#labels).

`bind()` registers one binding per action on a `Keyboard` or a
[`KeyBindings`](./key-chords.md#keybindings) registry, with the same `repeat`
and `priority` options for every action. The handler types require one
handler per action. A handler that returns `false` passes the key on to the
next matching binding and keeps the browser default. `bind()` returns one
function that removes every binding it made.

## Rebinding

Rebuild the map from the current overrides when one action changes, and store
the new `overrides`:

```ts
let map = new KeyBindingMap(DEFAULTS, JSON.parse(stored));
let release = map.bind(keyboard, handlers);

function rebind(action: Action, chords: readonly string[]): void {
  const next = new KeyBindingMap(DEFAULTS, {
    ...map.overrides,
    [action]: chords
  });

  release();
  map = next;
  release = map.bind(keyboard, handlers);
  storage.set(key, JSON.stringify(map.overrides));
}
```

Building the map before releasing the old bindings leaves the previous
shortcuts in place when the new overrides are rejected.

`KEY_CODES` lists every key code a chord accepts, for a settings screen that
offers them.
