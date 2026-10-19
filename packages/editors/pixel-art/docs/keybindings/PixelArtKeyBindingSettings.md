# PixelArtKeyBindingSettings

Per-browser keyboard shortcuts for a `PixelDrawPanel`. They are stored as the difference from
`PIXEL_ART_KEY_BINDINGS` and can be edited from the console's `pixelart.keybinds` namespace.

```ts
import {
  PixelArtKeyBindingSettings,
  pixelArtConsole
} from "@jolly-pixel/editor.pixel-art";

const keyBindingSettings = PixelArtKeyBindingSettings.follow(
  preferences,
  (message) => console.warn(message)
);

panel.keyBindings = keyBindingSettings;
const features = pixelArtConsole(commands, { keyBindingSettings, uvNets });
```

Keybinds are per browser. They are not part of the asset and are not sent to peers. Every editor
that embeds a `PixelDrawPanel` creates its own `PixelArtKeyBindingSettings` on the same storage key, so a
shortcut changed in one editor applies in the others on the same origin after a reload.

The default `selectAll` action is `Mod+a` (Ctrl+A on Windows/Linux and Cmd+A on macOS).
While hovering the canvas in Select mode, it selects the full texture. Editable fields
keep their native Select All behavior. Rebind it with `pixelart.keybinds.selectAll`.

## Settings

```ts
class PixelArtKeyBindingSettings extends KeyBindingSettings<PixelArtAction> {
  static follow(
    preferences: Preferences,
    onDropped?: (message: string) => void
  ): PixelArtKeyBindingSettings;

  constructor(options?: {
    overrides?: unknown;
    onDropped?: (message: string) => void;
  });
}
```

A [`KeyBindingSettings`](../../../../controls/docs/key-binding-settings.md) over
`PIXEL_ART_KEY_BINDINGS`. Assign it to `panel.keyBindings`: the panel binds it while
connected and follows every change.

`follow` keeps the bindings in the `pixel-art-keybindings` preference scope
(`PIXEL_ART_KEYBINDINGS` from `@jolly-pixel/editor.pixel-art/preferences`) with
[`followKeyBindings`](../../../host/docs/preferences/Preferences.md#followkeybindings),
and rebinds when the scope changes in the studio's Settings tab. The three editors that show the
panel use it, so one set of panel shortcuts follows the account.

Bindings are [key chords](../../../../controls/docs/key-chords.md) such as `"Mod+Shift+z"`. A
lowercase letter follows the printed key and a code such as `"KeyZ"` follows the key position.
An empty list unbinds the action.

## Defaults

```ts
const PIXEL_ART_KEY_BINDINGS: {
  selectAll: "Mod+a";
  copy: "Mod+c";
  paste: "Mod+v";
  undo: "Mod+z";
  redo: ["Mod+y", "Mod+Shift+z"];
  delete: "Delete";
  rotate: "r";
  rotateCounterClockwise: "Shift+r";
  flipHorizontal: "h";
  flipVertical: "v";
};

type PixelArtAction = keyof typeof PIXEL_ART_KEY_BINDINGS;
```

`new PixelArtKeyBindingSettings({ overrides })` builds settings without preferences, for
example to set `panel.keyBindings` directly.

## Console

`pixelArtConsole(commands, { keyBindingSettings, uvNets })` is a
[console feature](../../../../console/docs/features.md) that registers every pixel-art namespace
under `pixelart`, and returns one handle for all of them. Editors that embed the panel call it
next to their own features. `uvNets` is the panel's [`UvNetLibrary`](../uv/UvNetLibrary.md), behind
`pixelart.nets`. It registers `pixelart.keybinds` through `keybindConsole`:

| Input | Effect |
|---|---|
| `pixelart.keybinds.undo` | prints `Mod+z` |
| `pixelart.keybinds.undo Mod+u` | rebinds undo |
| `pixelart.keybinds.redo Mod+y Mod+Shift+z` | several chords give several bindings |
| `pixelart.keybinds.delete ""` | unbinds delete |
| `pixelart.keybinds.copy "Mod+z"` | prints the `KeyChordConflictError` message; nothing changes |
| `pixelart.keybinds.undo "mod+u"` | prints the `InvalidKeyChordError` message; nothing changes |
| `/pixelart.keybinds.reset undo` | restores the default of undo |
| `/pixelart.keybinds.reset` | restores every default |

After `/cd pixelart.keybinds`, the same lines work without the prefix: `undo "Mod+u"`,
`/reset undo`.

There is one `list` variable of `string` items per action of `keyBindings.actions`.

Another editor can register the same variables and `reset` command over its own
`KeyBindingSettings`:

```ts
function registerKeyBindingVariable<TAction extends string>(
  namespace: ConsoleNamespace,
  settings: KeyBindingSettings<TAction>,
  action: TAction,
  name?: string
): RegistrationHandle;
function registerKeyBindingReset<TAction extends string>(
  namespace: ConsoleNamespace,
  settings: KeyBindingSettings<TAction>
): RegistrationHandle;
```

`name` defaults to the action. The `reset` command prints `nothing` for an action whose default
is unbound.
