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
| `closable` | `boolean` | `false` |
| `tooltip` | `string` | `""` |

`jolly-tabs` controls `active`, the panel ID, and its ARIA relationship. The
default slot contains panel content.

`tooltip` sets the `title` of the tab button when not empty. `closable` adds a close button next to the tab button. See
[`jolly-tabs`](./tabs.md) for the event it raises.
