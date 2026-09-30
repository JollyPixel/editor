# KeybindingSettings

Per-browser keyboard shortcuts for a `PixelDrawPanel`, stored as the difference from
`DEFAULT_KEYBINDINGS` and editable from the console's `keybind` namespace.

```ts
import { registerConsoleFeatures } from "@jolly-pixel/console";
import { LocalStorageAdapter } from "@jolly-pixel/ui";
import {
  applyKeybindings,
  keybindConsole,
  KeybindingSettings
} from "@jolly-pixel/editor.pixel-art";

const keybindings = new KeybindingSettings({
  storage: new LocalStorageAdapter(),
  onDropped: (message) => console.warn(message)
});
await panel.initialize({
  keybindings: keybindings.overrides
});

const stopApplying = applyKeybindings(panel, keybindings);
const features = registerConsoleFeatures(
  commands,
  [keybindConsole],
  { keybindings }
);
```

Keybinds are per browser. They are not part of the asset and are not sent to peers.

## Settings

```ts
new KeybindingSettings(options: {
  storage: StorageAdapter;
  storageKey?: string;
  onDropped?: (message: string) => void;
});

get overrides(): KeybindingOverrides;
get bindings(): KeybindingsMap;
bindingsOf(action: KeybindingAction): Keybinding[];
assign(action: KeybindingAction, bindings: readonly Keybinding[]): void;
reset(action?: KeybindingAction): void;

type KeybindingOverrides = Partial<Record<KeybindingAction, Keybinding[]>>;
```

The constructor reads `storageKey` (`KEYBINDINGS_STORAGE_KEY`, `"pixel-art:keybindings"`) from
`storage`. The stored value is a JSON object from action to a binding or a list of bindings. An
entry for an unknown action, of the wrong shape, malformed, or conflicting with the entries kept
before it is dropped: `onDropped` receives a message naming it, and the storage is rewritten
without it. A value that is not a JSON object drops every entry.

`overrides` is what differs from the defaults, the value to pass as the `keybindings` option at
boot. `bindings` is the full map with the overrides applied.

`assign()` validates the whole map first and throws `InvalidKeybindingError` or
`KeybindingConflictError` from `@jolly-pixel/pixel-draw.renderer`, leaving the bindings and the
storage unchanged. `reset(action)` restores one action's default, and `reset()` every action.
Both write the new difference to storage and emit `change` with the full map. An empty list
unbinds the action.

## Applying to the panel

```ts
function applyKeybindings(
  panel: KeybindingPanel,
  settings: KeybindingSettings
): () => void;
```

Patches every texture's canvas on each `change`, and the newly active canvas on
`texture-change`, so a texture added after a change picks up the current bindings when it is
shown. The returned function stops both.

## Console

`keybindConsole(commands, { keybindings })` is a
[console feature](../../../../console/docs/features.md). It registers the `keybind` namespace:

| Input | Effect |
|---|---|
| `keybind.undo` | prints `mod+z` |
| `keybind.undo "mod+u"` | rebinds undo |
| `keybind.redo "mod+y, mod+shift+z"` | a comma-separated list gives several bindings |
| `keybind.copy "mod+z"` | prints the `KeybindingConflictError` message; nothing changes |
| `/keybind.reset undo` | restores the default of undo |
| `/keybind.reset` | restores every default |

There is one `string` variable per entry of `KEYBINDING_ACTIONS`. `parseBindingList(value)` does
the splitting: it splits on commas, trims each item and skips empty ones.
