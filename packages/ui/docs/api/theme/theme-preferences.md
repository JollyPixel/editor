# `jolly-theme-preferences`

`jolly-theme-preferences` renders theme and density controls, persists their
values, and applies them to a scope.

```html
<jolly-scope>
  <jolly-theme-preferences storage-key="editor:appearance">
  </jolly-theme-preferences>
</jolly-scope>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `layout` | `layout` | `"inline" \| "stack"` | `"inline"` |
| `target` | none | `HTMLElement \| null` | `null` |
| `storageKey` | `storage-key` | `string` | `""` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |
| `defaultTheme` | none | `ThemeMode` | `"auto"` |
| `defaultDensity` | none | `Density` | `"default"` |

With a null `target`, the nearest `jolly-scope` receives the values. Set
`target` when another element owns `themeStyles`. An empty `storageKey`
disables persistence.

## Layout

The default, `inline`, is `display: contents`: both controls flatten into the
row that hosts this element and wrap independently, which is what a horizontal
action bar wants.

Inside a vertical container such as a `jolly-pane`, use `stack`:

```html
<jolly-pane heading="Configuration">
  <jolly-theme-preferences
    layout="stack"
    storage-key="editor:appearance"
  ></jolly-theme-preferences>
</jolly-pane>
```

Flattened controls become flex items of the pane body, where their `1 1 96px`
basis is read as height and their grow factor stretches them down the pane,
leaving a gap between theme and density. `stack` makes the host a grid, so the
two rows keep their own height at the top of the pane.
