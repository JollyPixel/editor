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

The default slot accepts `jolly-pane` and `jolly-pane-group` children. A dock
without either is `empty` from its first render: a dock that is not an overlay
then takes no space and paints nothing, but still accepts a dragged pane and
grows back to `size`. Leave `align` and `overlay` unset on a dock meant to
start empty, so what lands there fills it. Resizing emits `jolly-resize`
and then `jolly-resize-end` with `{ width, height, collapsed }`. Double-click
or Enter toggles a collapsible dock. Public geometry methods support
`jolly-dock-layout`; `slots()` returns the slotted panes and groups, and
`panes()` every pane, grouped ones included.

An overlay dock is `pointer-events: none !important`, so the area around its
panes reaches whatever it covers even when page CSS sets `pointer-events` on
`jolly-dock`. Its panes and resize handle still take pointer events, except
the handle of an empty overlay dock. `jolly-pane`, `jolly-floating`,
`jolly-controls` and a non-overlay `jolly-dock` declare `pointer-events: auto`,
so a page can put them inside a `pointer-events: none` layer without
re-enabling each one:

```css
jolly-scope {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
```
