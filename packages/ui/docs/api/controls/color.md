# `jolly-color`

`jolly-color` combines an editable hex field with an anchored color picker. It
implements the [shared field API](../field/shared-field-api.md).

```html
<jolly-color label="Tint" alpha></jolly-color>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `alpha` | `alpha` | `boolean` | `false` |

The field accepts three-digit and six-digit hex values, with or without `#`.
When `alpha` is true, it emits eight-digit `#rrggbbaa` values. Output is
lowercase.

Picker movement emits `jolly-input`; release emits `jolly-change`. Escape
restores the value captured when the popover opened. Enter or blur commits a
typed hex value.
