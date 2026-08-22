# `jolly-monitor`

`jolly-monitor` renders a read-only label and value row.

```html
<jolly-monitor label="Draw calls"></jolly-monitor>
```

| Property | Type | Default |
|---|---|---|
| `label` | `string` | `""` |
| `value` | `number \| string` | `""` |
| `format` | `(value: number) => string \| undefined` | `undefined` |

`format` applies only when `value` is a number. The application supplies each
new value; the component does not poll.
