# KeyBindingSettings

Per-browser keyboard shortcuts for a `PixelDrawPanel`. They are stored as the difference from
`PixelArtKeyBindings.defaults` and can be edited from the console's `pixelart.keybinds` namespace.

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

get keyBindings(): PixelArtKeyBindings;
bind(target: { keyBindings: PixelArtKeyBindings; }): () => void;
chordsBoundTo(action: PixelArtAction): KeyChordString[];
assign(action: PixelArtAction, bindings: readonly string[]): void;
reset(action?: PixelArtAction): void;
```

Bindings are [key chords](../../../../controls/docs/key-chords.md) such as `"Mod+Shift+z"`. A
lowercase letter follows the printed key and a code such as `"KeyZ"` follows the key position.

The constructor reads `storageKey` (`KEY_BINDINGS_STORAGE_KEY`, `"pixel-art:keybindings"`) from
`storage` and reads it with `PixelArtKeyBindings.parse()`. `onDropped` receives the message
of each dropped entry, and the storage is rewritten without it.

`keyBindings` holds the stored overrides, ready for `panel.keyBindings`. `chordsBoundTo()` lists
the chords of one action after overrides. `bind(target)` sets `target.keyBindings` now and after
every change, until the returned function is called.

`assign()` and `reset()` go through `rebind()` and `restore()`, so they throw the same errors
and leave the bindings and the storage unchanged when they do. An empty list unbinds the
action. `reset()` without an action restores every action. Both methods save the new
difference and emit `change` with the new bindings.

## PixelArtKeyBindings

```ts
class PixelArtKeyBindings extends KeyBindingMap<PixelArtAction> {
  static readonly defaults: KeyBindingDefaults<PixelArtAction>;
  static parse(json: string): {
    keyBindings: PixelArtKeyBindings;
    dropped: string[];
  };

  constructor(overrides?: KeyBindingOverrides<PixelArtAction>);
  rebind(action: PixelArtAction, chords: string | readonly string[]): PixelArtKeyBindings;
  restore(action?: PixelArtAction): PixelArtKeyBindings;
  toJSON(): KeyBindingOverrides<PixelArtAction>;
}
```

An immutable [KeyBindingMap](../../../../controls/docs/key-binding-map.md) over the pixel-art
actions. `rebind()` and `restore()` return new bindings. `rebind()` throws
`InvalidKeyChordError` for a malformed chord, or `KeyChordConflictError` for a chord already
bound to another action, both from `@jolly-pixel/controls`. `restore(action)` drops the
override of one action, and `restore()` drops every override. `toJSON()` returns `overrides`,
the difference from `defaults`.

`parse()` reads a JSON object from action to a chord or a list of chords. It drops an unknown
action, a value of the wrong shape, a chord not written in the canonical form (`"mod+z"`), or
a chord that conflicts with an entry kept before it, and `dropped` holds a message naming each
one. A value that is not a JSON object drops every entry.

## Console

`pixelArtConsole(commands, { keyBindingSettings })` is a
[console feature](../../../../console/docs/features.md) that registers every pixel-art namespace
under `pixelart`, and returns one handle for all of them. Editors that embed the panel call it
next to their own features. It registers `pixelart.keybinds` through `keybindConsole`:

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
