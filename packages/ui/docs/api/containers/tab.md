# `jolly-tab`

`jolly-tab` is one panel owned by `jolly-tabs`.

```html
<jolly-tab value="build" label="Build">Build settings</jolly-tab>
```

| Property | Type | Default |
|---|---|---|
| `label` | `string` | `""` |
| `value` | `string` | `""` |
| `disabled` | `boolean` | `false` |
| `active` | `boolean` | `false` |

`jolly-tabs` controls `active`, the panel ID, and its ARIA relationship. The
default slot contains panel content.
