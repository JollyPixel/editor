# ShortcutLabels

A `ShortcutLabels` writes tooltip text such as `Undo (Ctrl+Z)` from the
chords a [`KeyBindingSettings`](./key-binding-settings.md) binds to an action.
Letters follow the layout of a
[`KeyboardLayoutStore`](./key-chords.md#labels), so a rebind or a layout
change shows in the next label.

```ts
import {
  KeyBindingSettings,
  KeyboardLayoutStore,
  ShortcutLabels
} from "@jolly-pixel/controls";

const settings = new KeyBindingSettings({
  defaults: {
    undo: "Mod+z",
    redo: ["Mod+y", "Mod+Shift+z"],
    pick: []
  }
});
const shortcuts = new ShortcutLabels(new KeyboardLayoutStore(), settings);

// On Windows and Linux; macOS writes "⌘Z".
shortcuts.label("Undo", "undo"); // "Undo (Ctrl+Z)"
shortcuts.label("History", "undo", "redo"); // "History (Ctrl+Z / Ctrl+Y)"
shortcuts.label("Pick", "pick"); // "Pick"

const stop = shortcuts.subscribe(() => button.requestUpdate());
```

## Constructor

```ts
new ShortcutLabels<TAction extends string>(
  layout: KeyboardLayoutStore,
  settings: KeyBindingSettings<TAction>
)
```

## Members

```ts
format(action: TAction): string | null;
label(text: string, ...actions: TAction[]): string;
subscribe(listener: () => void): () => void;
```

`format()` returns the first chord bound to an action, formatted with
[`KeyChord.format()`](./key-chords.md) on the current layout, or `null` when
the action is unbound.

`label()` appends the first chord of each action to `text`, in parentheses
and separated by ` / `. An unbound action adds nothing, and `text` comes back
alone when no action is bound.

`subscribe()` calls `listener` on each `change` of the settings or of the
layout, until the returned function is called.
