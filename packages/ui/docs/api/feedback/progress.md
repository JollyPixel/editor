# `jolly-progress`

`jolly-progress` renders determinate or indeterminate progress.

```html
<jolly-progress value="37" max="100" label="Loading assets"></jolly-progress>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `value` | `value` | `number \| null` | `null` |
| `max` | `max` | `number` | `1` |
| `label` | `label` | `string` | `""` |
| `valueText` | `value-text` | `string` | `""` |
| `animated` | `animated` | `boolean` | `false` |
| `completed` | `completed` | `boolean` | `false` |

`null` produces an indeterminate bar. Rendering clamps determinate values to
the normalized range without changing the supplied properties. The component
exposes `track` and `indicator` CSS parts.
