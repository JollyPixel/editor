# `jolly-density-control`

`jolly-density-control` renders a select preconfigured with the three density
values.

```html
<jolly-density-control label="Density"></jolly-density-control>
```

| Property | Type | Default |
|---|---|---|
| `value` | `"compact" \| "default" \| "comfortable"` | `"default"` |
| `label` | `string` | `"Density"` |

Selection updates `value` and emits `jolly-change` with `{ value }`. The
component does not apply the density to a scope.
