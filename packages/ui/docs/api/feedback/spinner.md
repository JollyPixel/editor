# `jolly-spinner`

`jolly-spinner` renders an indeterminate busy indicator for an operation with
no known duration. Use [`jolly-progress`](./progress.md) when a ratio is
available.

```html
<jolly-spinner label="Adding texture"></jolly-spinner>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `label` | `label` | `string` | `""` |

A non-empty `label` exposes the element as a `status` role carrying that
accessible name. An empty `label` hides it from assistive technology, which is
the right default when the spinner sits inside an already labelled control.

The component exposes a `spinner` CSS part and reads these custom properties:

| Property | Default | Role |
|---|---|---|
| `--jolly-spinner-size` | `1em` | Outer diameter; inherits the font size by default |
| `--jolly-spinner-thickness` | `2px` | Ring width |
| `--jolly-spinner-color` | `currentColor` | Leading arc color |
| `--jolly-spinner-track` | 24% of the color | Remaining ring color |
| `--jolly-spinner-duration` | `700ms` | One full rotation |

Under `prefers-reduced-motion: reduce` the rotation becomes an opacity pulse.
