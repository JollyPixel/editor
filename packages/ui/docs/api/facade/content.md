# Note, element and theme preference facades

## `addNote(options?): FacadeNote`

Creates a `jolly-property-row`: field-aligned text with no bound value.

```ts
interface NoteOptions extends FieldLayoutOptions {
  label?: string;
  description?: string;
  descriptionDisplay?: "block" | "tooltip";
  align?: "start" | "end";
}

const note = folder.addNote({
  description: "Peer indicators outside the camera frustum are skipped."
});

note.description = "Updated copy.";
```

- `label` and `description` stay writable on the builder.
- Unset options keep the element defaults, after the pane's
  [field layout](./pane.md#field-layout).
- For richer markup, use `note.element` or `addElement()`.

## `addThemePreferences(options?): FacadeThemePreferences`

Creates a [`jolly-theme-preferences`](../theme/theme-preferences.md).

```ts
interface ThemePreferencesOptions {
  layout?: "inline" | "stack"; // default "stack" here
  storageKey?: string;
  target?: HTMLElement; // default: the nearest jolly-scope
}

chrome.addThemePreferences({ storageKey: "three-examples" });
```

`layout` defaults to `"stack"`, unlike the element, so the controls line up
with the pane's label column.

## `addElement(element): FacadeElement<TElement>`

Appends an element the caller built and tracks it like a builder, so
`disposeAll()` reaches it.

```ts
const preview = folder.addElement(document.createElement("canvas"));

preview.hidden = !settings.showPreview;
```

- `preview.element` keeps its type, here `HTMLCanvasElement`.
- Prefer it to `element.append()`: on a floating `Pane`, `element` is the
  window, so an appended child lands beside the pane.
