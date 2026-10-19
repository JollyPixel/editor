# KeyBindingSettings

A `KeyBindingSettings` keeps the current [`KeyBindingMap`](./key-binding-map.md)
of a feature and emits `change` with each new map. It stores nothing: save
`keyBindings.overrides` on `change`, and hand the saved value back through
`overrides` or `load()`.

```ts
import {
  Keyboard,
  KeyBindingSettings
} from "@jolly-pixel/controls";

const settings = new KeyBindingSettings({
  defaults: {
    undo: "Mod+z",
    redo: ["Mod+y", "Mod+Shift+z"]
  },
  overrides: JSON.parse(localStorage.getItem("editor:keybindings") ?? "{}"),
  onDropped: (message) => console.warn(message)
});
settings.on("change", (keyBindings) => {
  localStorage.setItem("editor:keybindings", JSON.stringify(keyBindings));
});

const release = settings.bind(keyboard, handlers);

settings.assign("undo", ["Mod+u"]);
settings.reset("undo");
```

## Constructor

```ts
new KeyBindingSettings<TAction extends string>(
  options: KeyBindingSettingsOptions<TAction>
)

interface KeyBindingSettingsOptions<TAction extends string> {
  defaults: KeyBindingDefaults<TAction>;
  overrides?: unknown;
  onDropped?: (message: string) => void;
}
```

The constructor reads `overrides` with
[`KeyBindingMap.from()`](./key-binding-map.md#parsing-stored-overrides), and
`onDropped` receives each dropped message. Without `overrides`, the map
holds the defaults.

## Members

```ts
get keyBindings(): KeyBindingMap<TAction>;

bind(
  target: KeyBindingTarget,
  handlers: Partial<KeyBindingHandlers<TAction>>,
  options?: KeyBindingOptions
): () => void;
chordsBoundTo(action: TAction): KeyChordString[];
assign(action: TAction, chords: readonly string[]): void;
reset(action?: TAction): void;
load(overrides: unknown): void;
```

`bind()` binds the handlers with
[`KeyBindingMap.bind()`](./key-binding-map.md#members), then binds them again
with each new map, until the returned function is called. A component that
listens only while it is mounted keeps the settings and calls `bind()` when it
connects.

`chordsBoundTo()` returns the chords of an action in canonical form, such as
`["Mod+y", "Mod+Shift+z"]`.

`assign()` replaces the chords of an action and `reset()` restores the
defaults of one action, or of every action. Each one emits `change`. A chord
that [`KeyBindingMap`](./key-binding-map.md#errors) rejects throws, and the
map stays as it was.

`load()` replaces every override at once, as the constructor reads them, so
a set that swaps two chords loads in one step. It emits `change` only when
the map differs, so a store that sends each saved value back does not loop.

## Events

```ts
type KeyBindingSettingsEvents<TAction extends string> = {
  change: (keyBindings: KeyBindingMap<TAction>) => void;
};
```
