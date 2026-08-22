# `jolly-dock`

`jolly-dock` places panes along one edge and provides an inward resize handle.

```html
<jolly-dock key="left" side="left" align="start" collapsible>
  <jolly-pane key="hierarchy" heading="Hierarchy"></jolly-pane>
</jolly-dock>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `side` | `side` | `"left" \| "right" \| "top" \| "bottom"` | `"left"` |
| `align` | `align` | `"start" \| "end" \| null` | `null` |
| `overlay` | `overlay` | `boolean` | `false` |
| `key` | `key` | `string` | `""` |
| `size` | `size` | `number` | `240` |
| `collapsible` | `collapsible` | `boolean` | `false` |
| `collapsed` | `collapsed` | `boolean` | `false` |
| `empty` | `empty` | `boolean` | Derived from slotted panes |
| `minSize` | `min-size` | `number` | `120` |
| `maxSize` | `max-size` | `number` | `Infinity` |
| `storageKey` | `storage-key` | `string` | `""` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |

The default slot accepts `jolly-pane` children. Resizing emits `jolly-resize`
and then `jolly-resize-end` with `{ width, height, collapsed }`. Double-click
or Enter toggles a collapsible dock. Public geometry methods support
`jolly-dock-layout`; `panes()` returns the slotted panes.
