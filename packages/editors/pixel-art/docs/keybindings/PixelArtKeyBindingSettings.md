# PixelArtKeyBindingSettings

Per-browser keyboard shortcuts for a `PixelDrawPanel`. They are stored as the difference from
`PIXEL_ART_KEY_BINDINGS` and can be edited from the console's `pixelart.keybinds` namespace.

```ts
import { LocalStorageAdapter } from "@jolly-pixel/ui";
import {
  PixelArtKeyBindingSettings,
  pixelArtConsole
} from "@jolly-pixel/editor.pixel-art";

const keyBindingSettings = new PixelArtKeyBindingSettings({
  storage: new LocalStorageAdapter(),
  onDropped: (message) => console.warn(message)
});

const release = keyBindingSettings.sync(panel);
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
  constructor(options: {
    storage: StorageAdapter;
    onDropped?: (message: string) => void;
  });
}
```

A [`KeyBindingSettings`](../../../../controls/docs/key-binding-settings.md) over
`PIXEL_ART_KEY_BINDINGS`, saved under `KEY_BINDINGS_STORAGE_KEY` (`"pixel-art:keybindings"`).
`keyBindings` is ready for `panel.keyBindings`, and `sync(panel)` keeps it there after every
change.

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
type PixelArtKeyBindings = KeyBindingMap<PixelArtAction>;
```

`new KeyBindingMap(PIXEL_ART_KEY_BINDINGS, overrides)` builds a `PixelArtKeyBindings` without a
storage, for example to set `panel.keyBindings` directly. See
[KeyBindingMap](../../../../controls/docs/key-binding-map.md) for `rebind()`, `restore()` and
`parse()`.

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
