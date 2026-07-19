# Keybindings

`Keybindings` stores `PixelArtCanvas`'s configurable keyboard shortcuts and matches `KeyboardEvent`s against them. `InputController` owns one (`PixelArtCanvasOptions.keybindings`, `PixelArtCanvas.keybindings`, see [PixelArtCanvas.md](../PixelArtCanvas.md#keybindings)).

## Types

```ts
new Keybindings(patch?: Partial<KeybindingsMap>)

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

type KeybindingsMap = Record<KeybindingAction, Keybinding | Keybinding[]>;
```

A `Keybinding` is a `+`-separated combo string, e.g. `"mod+z"` or `"mod+shift+z"`. `"mod"` matches either Ctrl or Cmd, so a binding behaves the same on every platform.

> [!IMPORTANT]
> The key segment is matched against the character produced (`KeyboardEvent.key`, case-insensitive), not physical key position. `"z"` means "whatever key produces the Z character on the user's layout," correct on AZERTY/QWERTZ without the DSL needing to know about layouts. `NamedKey` lists the non-printable keys for editor autocomplete; any other string is still accepted.

Only `copy`, `paste`, `undo`, `redo`, `delete`, `rotate`, `flipHorizontal`, and `flipVertical` are configurable. Shift (used to arm/disarm the line tool in `"paint"` mode) is not.

The constructor's `patch` argument is merged onto `DEFAULT_KEYBINDINGS`; unspecified actions keep their default binding.

## Constants

```ts
const DEFAULT_KEYBINDINGS: KeybindingsMap = {
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

`redo` has two default triggers; any action may be given an array of alternate bindings. `rotate`/`flipHorizontal`/`flipVertical` only have an effect in `"select"` mode with an active selection (rotate is clockwise-only; press it multiple times for other angles).

Matching is exact on modifiers: `"mod+c"` does **not** also match Ctrl+Shift+C, and the default `"Delete"` binding (no modifier) does not also match Ctrl+Delete.

## Properties

### `bindings`

```ts
get bindings(): Readonly<KeybindingsMap>
```

The currently effective keybindings.

## Methods

### `patch`

```ts
patch(patch: Partial<KeybindingsMap>): void
```

Merges `patch` onto the current bindings (actions not present in `patch` keep their current binding). Throws `InvalidKeybindingError` for a malformed combo string, or `KeybindingConflictError` if the result would bind two actions to the same combo; either way the previous bindings remain in effect.

### `match`

```ts
match(event: KeyboardEvent): KeybindingAction | null
```

Returns the action bound to `event`, or `null` if none matches. Used internally by `InputController`; exposed for consumers that want to reuse the same matching logic elsewhere.

## Errors

```ts
class InvalidKeybindingError extends Error {}
class KeybindingConflictError extends Error {}
```

Both are thrown synchronously, from the constructor and from `patch()`: never asynchronously, and never left as a silently-dropped binding. `InvalidKeybindingError` is thrown for a malformed combo string (unknown modifier token, empty/missing key segment). `KeybindingConflictError` is thrown when two different actions would resolve to the same combo.
