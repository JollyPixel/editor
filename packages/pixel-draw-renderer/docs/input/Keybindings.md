# Keybindings

Configurable keyboard shortcuts for `PixelArtCanvas`. See [PixelArtCanvas.md](../PixelArtCanvas.md#keybindings).

```ts
new Keybindings(patch?: Partial<KeybindingsMap>)
```

`patch` is merged onto `DEFAULT_KEYBINDINGS`; omitted actions keep their defaults.

## Keybinding format

A combo string of `+`-separated modifiers followed by a key: `"mod+z"`, `"mod+shift+z"`, `"Delete"`.

- `mod`: Ctrl or Cmd/Meta on every platform; the matcher does not distinguish between them
- Key is matched against `KeyboardEvent.key` (case-insensitive)
- Modifier matching is exact for `mod`, `shift`, and `alt`: `"mod+c"` does **not** match Ctrl+Shift+C

```ts
type ModifierToken = "mod" | "shift" | "alt";
type Keybinding =
  | KeyToken
  | `${ModifierToken}+${KeyToken}`
  | `${ModifierToken}+${ModifierToken}+${KeyToken}`
  | `${ModifierToken}+${ModifierToken}+${ModifierToken}+${KeyToken}`;
type KeybindingsMap = Record<KeybindingAction, Keybinding | Keybinding[]>;
```

## PixelArtCanvas routing

`PixelArtCanvas` dispatches shortcuts only while the pointer is over its canvas. It ignores repeated keydown events and events from text-entry `<input>` elements, `<textarea>` elements, and `contenteditable` elements.

`Shift` and `Space` are reserved for line drawing and panning. They are handled before configurable shortcuts, so a binding whose final key is `Shift` or `Space` is not dispatched by `PixelArtCanvas`. Calling `Keybindings.match()` directly does not apply these routing rules.

## Defaults

| Action | Default |
|---|---|
| Copy | `Ctrl`/`Cmd`+`C` |
| Paste | `Ctrl`/`Cmd`+`V` |
| Undo | `Ctrl`/`Cmd`+`Z` |
| Redo | `Ctrl`/`Cmd`+`Y` or `Ctrl`/`Cmd`+`Shift`+`Z` |
| Delete | `Delete` |
| Rotate selection | `R` |
| Flip selection horizontal | `H` |
| Flip selection vertical | `V` |

> [!IMPORTANT]
> `rotate`, `flipHorizontal`, `flipVertical` only apply in `"select"` mode with an active selection. Any action can be given an array of bindings.

## API

### `bindings`

```ts
get bindings(): Readonly<KeybindingsMap>
```

### `patch(patch)`

```ts
patch(patch: Partial<KeybindingsMap>): void
```

Merges onto current bindings. Throws on conflict or bad format; previous bindings stay in effect.

### `match(event)`

```ts
match(event: KeyboardEvent): KeybindingAction | null
```

Returns the matching action, or `null`.

## Errors

| Error | When |
|---|---|
| `InvalidKeybindingError` | Malformed combo string (bad modifier, empty segment) |
| `KeybindingConflictError` | Two actions resolve to the same combo |

Both throw synchronously from the constructor and `patch()`.
