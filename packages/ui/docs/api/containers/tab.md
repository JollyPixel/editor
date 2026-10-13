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
| `modified` | `boolean` | `false` |
| `status` | `TabStatus` | `"idle"` |

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

`modified` marks a tab with unsaved changes. A closable tab shows a dot in
place of its close glyph until the pointer is over the tab; any other tab shows
the dot after its label. The tab button announces "Unsaved changes" as its
accessible description.

`status` is `"idle"`, `"busy"` or `"failed"`. A busy tab shows a spinner and a
failed one a warning icon, in the same place as the `modified` dot and in its
stead. The tab button gets `aria-busy` while busy and announces "Loading" or
"Failed to load" before "Unsaved changes". Size both with
`--jolly-tab-status-size` (`10px`), or style the `busy` and `failed` parts.
