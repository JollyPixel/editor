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
| `target` | none | `HTMLElement \| null` | `null` |
| `storageKey` | `storage-key` | `string` | `""` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |
| `defaultTheme` | none | `ThemeMode` | `"auto"` |
| `defaultDensity` | none | `Density` | `"default"` |

With a null `target`, the nearest `jolly-scope` receives the values. Set
`target` when another element owns `themeStyles`. An empty `storageKey`
disables persistence.
