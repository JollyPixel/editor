# KeyBindingSettings

Per-browser keyboard shortcuts for a `PixelDrawPanel`. They are stored as the difference from
`PIXEL_ART_KEY_BINDINGS` and can be edited from the console's `keybind` namespace.

```ts
import { registerConsoleFeatures } from "@jolly-pixel/console";
import { LocalStorageAdapter } from "@jolly-pixel/ui";
import {
  keybindConsole,
  KeyBindingSettings
} from "@jolly-pixel/editor.pixel-art";

const keyBindingSettings = new KeyBindingSettings({
  storage: new LocalStorageAdapter(),
  onDropped: (message) => console.warn(message)
});

panel.keyBindings = keyBindingSettings.keyBindings;
const unsubscribe = keyBindingSettings.subscribe("change", (keyBindings) => {
  panel.keyBindings = keyBindings;
});
const features = registerConsoleFeatures(
  commands,
  [keybindConsole],
  { keyBindingSettings }
);
```

Keybinds are per browser. They are not part of the asset and are not sent to peers.

## Settings

```ts
new KeyBindingSettings(options: {
  storage: StorageAdapter;
  storageKey?: string;
  onDropped?: (message: string) => void;
});

get keyBindings(): KeyBindingMap<PixelArtAction>;
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
`bindingsOf()` lists the chords of one action after overrides.

`assign()` builds the new map first. It throws `InvalidKeyChordError` for a malformed chord, or
`KeyChordConflictError` for a chord already bound to another action, both from
`@jolly-pixel/controls`. When it throws, the bindings and the storage stay unchanged. An empty
list unbinds the action. `reset(action)` restores one action's default, and `reset()` every
action. Both methods save the new difference and emit `change` with the new map.

## Console

`keybindConsole(commands, { keyBindingSettings })` is a
[console feature](../../../../console/docs/features.md). It registers the `keybind` namespace:

| Input | Effect |
|---|---|
| `keybind.undo` | prints `Mod+z` |
| `keybind.undo "Mod+u"` | rebinds undo |
| `keybind.redo "Mod+y, Mod+Shift+z"` | a comma-separated list gives several bindings |
| `keybind.copy "Mod+z"` | prints the `KeyChordConflictError` message; nothing changes |
| `keybind.undo "mod+u"` | prints the `InvalidKeyChordError` message; nothing changes |
| `/keybind.reset undo` | restores the default of undo |
| `/keybind.reset` | restores every default |

There is one `string` variable per action of `keyBindings.actions`. `parseBindingList(value)` does
the splitting: it splits on commas, trims each item and skips empty ones.
