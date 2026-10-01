# Key chords

A key chord names a key and its modifiers, such as `"Mod+Shift+z"`.
[`Keyboard.bind()`](./keyboard.md#bindings) takes chords, and `KeyChord`
matches and labels them.

## Position or printed letter

```ts
type KeyChordString = `${Modifiers}${KeyCode | KeyChordLetter}`;
```

Modifiers come first, in the order `Mod+`, `Shift+`, `Alt+`. `Mod` is Command
on Apple platforms and Control elsewhere.

The key is either a position or a printed letter:

| Chord | Matches | Use for |
|---|---|---|
| `"KeyQ"` | the key at the QWERTY Q position | spatial groups: WASD, Q/E rotation |
| `"q"` | the key printed Q on the user's layout | mnemonics: Ctrl+Z, R for replace |

```ts
keyboard.bind("KeyQ", rotateLeft);
keyboard.bind("Mod+z", undo);
```

On AZERTY, `"KeyQ"` is the key printed A and `"Mod+z"` follows the key
printed Z.

Letter chords accept `a` to `z` only. Shift and Caps Lock do not change the
letter, so `"Mod+Shift+z"` is Ctrl+Shift+Z. On layouts without Latin letters
the letter falls back to the key position. Digits, punctuation, and named keys
are always positions: `"Digit1"`, `"BracketLeft"`, `"Enter"`.

A chord requires its exact modifiers: `"g"` does not match Shift+G.

## KeyChord

```ts
class KeyChord {
  static parse(chord: KeyChordString): KeyChord;
  static from(value: string): KeyChord;
  constructor(options: KeyChordOptions);

  readonly code: KeyCode | null;
  readonly key: KeyChordLetter | null;
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;

  matches(event: KeyChordEvent, options?: { apple?: boolean; }): boolean;
  format(
    options?: { apple?: boolean; layout?: KeyboardLayout | null; }
  ): string;
  toString(): KeyChordString;
}
```

A chord has exactly one of `code` and `key`. `apple` defaults to
`isApplePlatform()`.

`parse()` takes a typed chord and `from()` an untrusted string, such as a
stored setting. Both throw `InvalidKeyChordError` unless the text is a chord
written exactly as `toString()` writes it: modifiers in order, a lowercase
letter or one of the `KEY_CODES`.

```ts
KeyChord.from("Mod+Shift+z"); // ok
KeyChord.from("mod+shift+z"); // throws InvalidKeyChordError
```

## Labels

`format()` writes a chord for a tooltip: `"Ctrl+Shift+Z"`, or `"⇧⌘Z"` on
Apple platforms.

```ts
KeyChord.parse("Mod+z").format(); // "Ctrl+Z"
KeyChord.parse("KeyQ").format(); // "Q"
KeyChord.parse("KeyQ").format({ layout }); // "A" on AZERTY
```

Without a layout, a position prints its QWERTY character. Pass the user's
layout to print the character on their keycap instead:

```ts
function loadKeyboardLayout(): Promise<KeyboardLayout | null>
```

It resolves to `null` where the browser cannot tell (Firefox, Safari, or an
iframe without `allow="keyboard-map"`), and `format()` then keeps the QWERTY
label. Browsers do not announce layout changes, so load it again when the
window regains focus.

## KeyBindings

```ts
class KeyBindings {
  bind(
    chords: KeyBindingChords,
    handler: (event: KeyboardEvent) => boolean | void,
    options?: { repeat?: boolean; priority?: number; }
  ): () => void;
  dispatch(event: KeyboardEvent): boolean;
}

type KeyBindingChord = KeyChord | KeyChordString;
type KeyBindingChords = KeyBindingChord | readonly KeyBindingChord[];
```

`KeyBindings` is the registry behind `Keyboard.bind()`, for keydowns that do
not come from a `Keyboard`. `dispatch()` runs the bindings for one keydown
and returns `true` when one handled it. Unlike `Keyboard`, it does not skip
editable targets or guarded keys.

To name the shortcuts of a feature by action and let users rebind them, see
[KeyBindingMap](./key-binding-map.md).
