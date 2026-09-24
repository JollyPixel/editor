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
| `badge` | `string` | `""` |
| `action` | `IconName` | `""` |
| `actionLabel` (`action-label`) | `string` | `""` |
| `icon` | `IconName` | `""` |
| `iconOnly` (`icon-only`) | `boolean` | `false` |
| `fixed` | `boolean` | `false` |

`jolly-tabs` controls `active`, the panel ID, and its ARIA relationship. The
default slot contains panel content.

`tooltip` sets the `title` of the tab button when not empty. `closable` adds a close button next to the tab button. See
[`jolly-tabs`](./tabs.md) for the event it raises.

`icon` renders a glyph before the label, sized by `--jolly-tab-icon-size`
(`16px`). `iconOnly` hides the label text and keeps it as the accessible name
and, without a `tooltip`, as the title. `fixed` keeps the tab in place in a
reorderable strip. See [Reordering](./tabs.md#reordering).

`badge` renders a short chip after the label, such as a count. `action` names
an icon rendered as a secondary button in the tab, and `actionLabel` is its
accessible name and tooltip. See [Tab actions](./tabs.md#tab-actions).
