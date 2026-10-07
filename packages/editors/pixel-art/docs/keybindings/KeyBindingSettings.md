# KeyBindingSettings

Per-browser keyboard shortcuts for a `PixelDrawPanel`. They are stored as the difference from
`PIXEL_ART_KEY_BINDINGS` and can be edited from the console's `pixelart.keybinds` namespace.

```ts
import { LocalStorageAdapter } from "@jolly-pixel/ui";
import {
  KeyBindingSettings,
  pixelArtConsole
} from "@jolly-pixel/editor.pixel-art";

const keyBindingSettings = new KeyBindingSettings({
  storage: new LocalStorageAdapter(),
  onDropped: (message) => console.warn(message)
});

const release = keyBindingSettings.bind(panel);
const features = pixelArtConsole(commands, { keyBindingSettings });
```

Keybinds are per browser. They are not part of the asset and are not sent to peers. Every editor
that embeds a `PixelDrawPanel` creates its own `KeyBindingSettings` on the same storage key, so a
shortcut changed in one editor applies in the others on the same origin after a reload.

The default `selectAll` action is `Mod+a` (Ctrl+A on Windows/Linux and Cmd+A on macOS).
While hovering the canvas in Select mode, it selects the full texture. Editable fields
keep their native Select All behavior. Rebind it with `pixelart.keybinds.selectAll`.

## Settings

```ts
new KeyBindingSettings(options: {
  storage: StorageAdapter;
  storageKey?: string;
  onDropped?: (message: string) => void;
});

get keyBindings(): KeyBindingMap<PixelArtAction>;
bind(target: { keyBindings: KeyBindingMap<PixelArtAction>; }): () => void;
bindingsOf(action: PixelArtAction): KeyChordString[];
assign(action: PixelArtAction, bindings: readonly string[]): void;
reset(action?: PixelArtAction): void;
```

Bindings are [key chords](../../../../controls/docs/key-chords.md) such as `"Mod+Shift+z"`. A
lowercase letter follows the printed key and a code such as `"KeyZ"` follows the key position.

The constructor reads `storageKey` (`KEY_BINDINGS_STORAGE_KEY`, `"pixel-art:keybindings"`) from
`storage`. The stored value is a JSON object from action to a chord or a list of chords. Some
entries are dropped: an unknown action, a value of the wrong shape, a chord not written in the
canonical form (`"mod+z"`), or a chord that conflicts with an entry kept before it. `onDropped`
receives a message naming each one, and the storage is rewritten without it. A value that is not
a JSON object drops every entry.

`keyBindings` is the [KeyBindingMap](../../../../controls/docs/key-binding-map.md) with the
stored overrides applied, ready for `panel.keyBindings`. Its `overrides` is what gets stored.
`bindingsOf()` lists the chords of one action after overrides. `bind(target)` sets
`target.keyBindings` now and after every change, until the returned function is called.

`assign()` builds the new map first. It throws `InvalidKeyChordError` for a malformed chord, or
`KeyChordConflictError` for a chord already bound to another action, both from
`@jolly-pixel/controls`. When it throws, the bindings and the storage stay unchanged. An empty
list unbinds the action. `reset(action)` restores one action's default, and `reset()` every
action. Both methods save the new difference and emit `change` with the new map.

## Console

`pixelArtConsole(commands, { keyBindingSettings })` is a
[console feature](../../../../console/docs/features.md) that registers every pixel-art namespace
under `pixelart`, and returns one handle for all of them. Editors that embed the panel call it
next to their own features. It registers `pixelart.keybinds` through `keybindConsole`:

| Input | Effect |
|---|---|
| `pixelart.keybinds.undo` | prints `Mod+z` |
| `pixelart.keybinds.undo "Mod+u"` | rebinds undo |
| `pixelart.keybinds.redo "Mod+y, Mod+Shift+z"` | a comma-separated list gives several bindings |
| `pixelart.keybinds.copy "Mod+z"` | prints the `KeyChordConflictError` message; nothing changes |
| `pixelart.keybinds.undo "mod+u"` | prints the `InvalidKeyChordError` message; nothing changes |
| `/pixelart.keybinds.reset undo` | restores the default of undo |
| `/pixelart.keybinds.reset` | restores every default |

After `/cd pixelart.keybinds`, the same lines work without the prefix: `undo "Mod+u"`,
`/reset undo`.

There is one `string` variable per action of `keyBindings.actions`. `parseBindingList(value)` does
the splitting: it splits on commas, trims each item and skips empty ones.
