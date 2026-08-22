# `jolly-text`

`jolly-text` edits a string and implements the
[shared field API](../field/shared-field-api.md).

```html
<jolly-text label="Name" placeholder="Unnamed"></jolly-text>
```

| Property | Type | Default |
|---|---|---|
| `placeholder` | `string` | `""` |
| `value` | `string \| typeof Mixed` | `""` |

Typing emits `jolly-input`. Enter or blur emits `jolly-change`. Escape discards
the current draft and stops the key from closing an outer dialog.
