# `jolly-color-picker`

`jolly-color-picker` is a standalone saturation, value, hue, and alpha picker.
It does not use the shared field row.

```html
<jolly-color-picker value="#4488ff" alpha></jolly-color-picker>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `value` | `value` | `string` | `"#000000"` |
| `alpha` | `alpha` | `boolean` | `false` |
| `hexInput` | `hex-input` | `boolean` | `true` |
| `disabled` | `disabled` | `boolean` | `false` |
| `readonly` | `readonly` | `boolean` | `false` |

Pointer and range-input movement emits `jolly-input`. Release or a committed
text edit emits `jolly-change`. Both events carry `{ value: string }`.
`focus()` moves focus to the saturation range.
