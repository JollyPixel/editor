# utils/keybindings

Types, defaults, and errors for `PixelArtCanvas`'s configurable keyboard shortcuts (`PixelArtCanvasOptions.keybindings`, `PixelArtCanvas.patchKeybindings()` / `keybindings`, see [PixelArtCanvas.md](../PixelArtCanvas.md)).

## Types

```ts
type ModifierToken = "mod" | "shift" | "alt";

type NamedKey =
  | "Delete" | "Backspace" | "Enter" | "Escape" | "Tab" | "Space"
  | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
  | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10" | "F11" | "F12";

type Keybinding =
  | NamedKey | (string & {})
  | `${ModifierToken}+${NamedKey | (string & {})}`
  | `${ModifierToken}+${ModifierToken}+${NamedKey | (string & {})}`
  | `${ModifierToken}+${ModifierToken}+${ModifierToken}+${NamedKey | (string & {})}`;

type KeybindingAction =
  | "copy" | "paste" | "undo" | "redo" | "delete"
  | "rotate" | "flipHorizontal" | "flipVertical";

type Keybindings = Record<KeybindingAction, Keybinding | Keybinding[]>;
```

A `Keybinding` is a `+`-separated combo string, e.g. `"mod+z"` or `"mod+shift+z"`. `"mod"` matches either Ctrl or Cmd, so a binding behaves the same on every platform.

> [!IMPORTANT]
> The key segment is matched against the character produced (`KeyboardEvent.key`, case-insensitive), not physical key position. `"z"` means "whatever key produces the Z character on the user's layout," correct on AZERTY/QWERTZ without the DSL needing to know about layouts. `NamedKey` lists the non-printable keys for editor autocomplete; any other string is still accepted.

Only `copy`, `paste`, `undo`, `redo`, `delete`, `rotate`, `flipHorizontal`, and `flipVertical` are configurable. Shift (used to arm/disarm the line tool in `"paint"` mode) is not.

## Constants

```ts
const DEFAULT_KEYBINDINGS: Keybindings = {
  copy: "mod+c",
  paste: "mod+v",
  undo: "mod+z",
  redo: ["mod+y", "mod+shift+z"],
  delete: "Delete",
  rotate: "r",
  flipHorizontal: "h",
  flipVertical: "v"
};
```

The keybindings `PixelArtCanvas` uses when `keybindings` isn't passed to its options, and the base a partial override is merged onto. `redo` has two default triggers; any action may be given an array of alternate bindings. `rotate`/`flipHorizontal`/`flipVertical` only have an effect in `"select"` mode with an active selection (rotate is clockwise-only; press it multiple times for other angles).

Matching is exact on modifiers: `"mod+c"` does **not** also match Ctrl+Shift+C, and the default `"Delete"` binding (no modifier) does not also match Ctrl+Delete.

## Errors

```ts
class InvalidKeybindingError extends Error {}
class KeybindingConflictError extends Error {}
```

Both are thrown synchronously from the constructor's `keybindings` option and from `patchKeybindings()`: never asynchronously, and never left as a silently-dropped binding. `InvalidKeybindingError` is thrown for a malformed combo string (unknown modifier token, empty/missing key segment). `KeybindingConflictError` is thrown when two different actions would resolve to the same combo.
