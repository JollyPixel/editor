# `jolly-theme-preferences`

`jolly-theme-preferences` renders theme and density controls, persists their
values and applies them to a scope.

```html
<jolly-scope>
  <jolly-theme-preferences storage-key="editor:appearance">
  </jolly-theme-preferences>
</jolly-scope>
```

## Properties

```ts
interface ThemePreferences {
  layout: "inline" | "stack"; // default "inline"
  target: HTMLElement | null; // property only, null: the nearest jolly-scope
  storageKey: string; // attribute storage-key, "" turns persistence off
  storage: StorageAdapter; // property only, default LocalStorageAdapter
  defaultTheme: ThemeMode; // property only, default "auto"
  defaultDensity: Density; // property only, default "default"
}
```

Set `target` when another element owns `themeStyles`.

## Layout

- `inline` is `display: contents`: both controls flatten into the hosting row,
  as a horizontal action bar wants.
- `stack` makes the host a grid. Use it in a vertical container such as a
  `jolly-pane`, where flattened controls would stretch down the pane.

```html
<jolly-pane heading="Configuration">
  <jolly-theme-preferences
    layout="stack"
    storage-key="editor:appearance"
  ></jolly-theme-preferences>
</jolly-pane>
```
