# Note, element and theme preference facades

## Notes

`addNote(options?)` creates a `jolly-property-row`: field-aligned text that
explains the rows around it without binding a value.

```ts
interface NoteOptions {
  label?: string;
  description?: string;
  align?: "start" | "end";
  labelPosition?: "inline" | "top";
}

const note = folder.addNote({
  description: "Peer indicators outside the camera frustum are skipped."
});

note.description = "Updated copy.";
```

`label` and `description` both default to `""` and stay mutable on the
builder. `align` and `labelPosition` are left to the element's own defaults
when unset, so a note lines up with the fields around it. Markup richer than
two strings belongs in the element itself, reached through `note.element` or
added with `addElement()`.

The builder exposes `element`, `label`, `description`, `hidden`, `disabled`,
and `dispose()`.

## Theme preferences

`addThemePreferences(options?)` creates a `jolly-theme-preferences` row pair.

```ts
interface ThemePreferencesOptions {
  layout?: "inline" | "stack";
  storageKey?: string;
  target?: HTMLElement;
}

chrome.addThemePreferences({ storageKey: "three-examples" });
```

`layout` defaults to `"stack"` here, not to the element's own `"inline"`: a
pane gives the controls a label column to line up with, and `inline` stretches
them across it. `storageKey` and `target` are forwarded untouched, and an
unset `target` resolves to the nearest `jolly-scope` as usual. See
[`jolly-theme-preferences`](../theme/theme-preferences.md).

The call returns a `FacadeElement`, so the element stays reachable for the
properties this facade does not cover.

## Any other element

`addElement(element)` appends an element the caller built and tracks it like a
builder, so it takes part in `disposeAll()` and gains `hidden`, `disabled`
and `dispose()`.

```ts
const canvas = document.createElement("canvas");
const preview = folder.addElement(canvas);

preview.hidden = !settings.showPreview;
```

`addElement()` keeps the element's own type, so `preview.element` is a
`HTMLCanvasElement`. Use it instead of `folder.element.append()`, which is
untracked and, on a floating `Pane`, appends beside the pane rather than
inside it.
