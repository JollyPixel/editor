# KeyBindingSettings

A `KeyBindingSettings` keeps the current [`KeyBindingMap`](./key-binding-map.md)
of a feature, saves its overrides under one storage key, and emits `change`
with each new map.

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
  storage: {
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value)
  },
  storageKey: "editor:keybindings",
  onDropped: (message) => console.warn(message)
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
  storage: KeyBindingStorage;
  storageKey: string;
  onDropped?: (message: string) => void;
}

interface KeyBindingStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}
```

The constructor reads `storageKey` with
[`KeyBindingMap.parse()`](./key-binding-map.md#parsing-stored-overrides).
`onDropped` receives each dropped message, and the storage is rewritten
without the dropped entries. A missing key gives the defaults and writes
nothing.

The `StorageAdapter` implementations of `@jolly-pixel/ui` fit
`KeyBindingStorage` as they are.

## Members

```ts
get keyBindings(): KeyBindingMap<TAction>;

bind(
  target: KeyBindingTarget,
  handlers: Partial<KeyBindingHandlers<TAction>>,
  options?: KeyBindingOptions
): () => void;
sync(target: KeyBindingsReceiver<TAction>): () => void;
chordsBoundTo(action: TAction): KeyChordString[];
assign(action: TAction, chords: readonly string[]): void;
reset(action?: TAction): void;

interface KeyBindingsReceiver<TAction extends string> {
  keyBindings: KeyBindingMap<TAction>;
}
```

`bind()` binds the handlers with
[`KeyBindingMap.bind()`](./key-binding-map.md#members), then binds them again
with each new map, until the returned function is called.

`sync()` sets `target.keyBindings` to the current map and again on every
change, until the returned function is called. It suits an object that binds
the map itself, such as a component that listens only while it is mounted.

`chordsBoundTo()` returns the chords of an action in canonical form, such as
`["Mod+y", "Mod+Shift+z"]`.

`assign()` replaces the chords of an action and `reset()` restores the
defaults of one action, or of every action. Each one saves the overrides and
emits `change`. A chord that [`KeyBindingMap`](./key-binding-map.md#errors)
rejects throws, and the map and storage stay as they were.

## Events

```ts
type KeyBindingSettingsEvents<TAction extends string> = {
  change: (keyBindings: KeyBindingMap<TAction>) => void;
};
```
