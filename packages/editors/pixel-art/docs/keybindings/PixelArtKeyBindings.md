# Pixel-art key bindings

Keyboard shortcuts for a `PixelDrawPanel`, stored per browser as the difference
from `PIXEL_ART_KEY_BINDINGS`. They are not part of the asset and are not sent
to peers.

```ts
import { followKeyBindings } from "@jolly-pixel/editor.host";
import { pixelArtConsole } from "@jolly-pixel/editor.pixel-art";
import { PIXEL_ART_KEYBINDINGS } from "@jolly-pixel/editor.pixel-art/preferences";

const keyBindingSettings = followKeyBindings(
  preferences,
  PIXEL_ART_KEYBINDINGS,
  (message) => console.warn(message)
);

panel.keyBindings = keyBindingSettings;
const features = pixelArtConsole(commands, { keyBindingSettings, uvNets });
```

## Settings

```ts
const PIXEL_ART_KEYBINDINGS: PreferenceScope<KeyBindingFields<PixelArtAction>>;
```

The `pixel-art-keybindings` preference scope. Every editor that embeds the panel
follows the same scope, so a shortcut changed in one applies to all of them.
The panel binds `keyBindings` while connected and follows its changes.

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

Without preferences, build the settings directly:
`new KeyBindingSettings({ defaults: PIXEL_ART_KEY_BINDINGS, overrides })`.

## Console

`pixelArtConsole(commands, { keyBindingSettings, uvNets })` registers every
pixel-art namespace under `pixelart` and returns one handle. `uvNets` backs
[`pixelart.nets`](../uv/UvNetLibrary.md#console).

`pixelart.keybinds` has one `list` variable per action:

- `pixelart.keybinds.undo` prints the binding; `pixelart.keybinds.undo Mod+u`
  rebinds it; `pixelart.keybinds.delete ""` unbinds it.
- An invalid or conflicting chord prints the error and changes nothing.
- `/pixelart.keybinds.reset undo` restores one default, `/pixelart.keybinds.reset`
  restores all.

Another editor registers the same variables and `reset` command over its own
settings:

```ts
function registerKeyBindingVariable<TAction extends string>(
  namespace: ConsoleNamespace,
  settings: KeyBindingSettings<TAction>,
  action: TAction,
  name?: string // defaults to action
): RegistrationHandle;
function registerKeyBindingReset<TAction extends string>(
  namespace: ConsoleNamespace,
  settings: KeyBindingSettings<TAction>
): RegistrationHandle;
```
