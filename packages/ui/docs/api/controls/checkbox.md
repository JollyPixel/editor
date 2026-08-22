# `jolly-checkbox`

`jolly-checkbox` edits a boolean value and implements the
[shared field API](../field/shared-field-api.md).

```html
<jolly-checkbox label="Visible" clickable-background></jolly-checkbox>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `clickableBackground` | `clickable-background` | `boolean` | `false` |

The native checkbox supplies keyboard behavior. `Mixed` renders as an
indeterminate checkbox; activating it commits `true`. User activation emits
`jolly-change`.
