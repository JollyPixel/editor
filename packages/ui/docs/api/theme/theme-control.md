# `jolly-theme-control`

`jolly-theme-control` renders a button group for light, dark, and automatic
theme selection.

```html
<jolly-theme-control label="Theme"></jolly-theme-control>
```

| Property | Type | Default |
|---|---|---|
| `value` | `"light" \| "dark" \| "auto"` | `"auto"` |
| `label` | `string` | `"Theme"` |

Selection updates `value` and emits `jolly-change` with `{ value }`. The
component does not apply the selected theme to a scope.
