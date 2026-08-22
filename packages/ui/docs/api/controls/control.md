# `jolly-control`

`jolly-control` renders one input hint inside `jolly-controls`.

```html
<jolly-control
  description="Sprint"
  details="Moves faster while the key is held"
><kbd>Shift</kbd><kbd>W</kbd></jolly-control>
```

| Property | Type | Default |
|---|---|---|
| `description` | `string` | `""` |
| `details` | `string` | `""` |

The default slot accepts one or more `kbd` elements. A non-empty `details`
value adds an information button and native popover. The host has
`role="listitem"`.
