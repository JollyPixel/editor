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
| `double` | `double` | `boolean` | `false` |
| `split` | `split` | `boolean` | Derived from the `secondary` slot |
| `shareTone` | `share-tone` | `boolean` | `false` |
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
or Enter toggles a collapsible dock.

The resize handle of a dock that is not an overlay sits on its inner edge,
inside the dock, and adds its thickness to `size`: panes never slide under
it, and neither does whatever sits next to the dock. A collapsed dock
shrinks to that handle, which stays visible. `--jolly-dock-handle-size` sets
the thickness (`4px`). An overlay dock keeps its handle just past its inner
edge.

Public geometry methods support
`jolly-dock-layout`; `slots()` returns the slotted panes and groups, and
`panes()` every pane, grouped ones included.

A `double` left or right dock that is not an overlay can open a second
column. Children with `slot="secondary"` fill it, and `split` is set while
it holds any. A split dock is twice `size` wide and its two columns share
that width equally: the resize handle stays on the inner edge and moves with
it, and `minSize` and `maxSize` apply to each column. The primary column
stays against the edge. `double` is ignored on top and bottom docks.

`slots(column?)`, `dropZone(column?)`, `previewZone(column?)`,
`dropCandidates(column?)`, `dropStacks(pane, column?)` and
`insertionLine(index, column?)` take `"primary"` (the default) or
`"secondary"`; `slots()` without a column returns both, primary first.
`acceptsSecondary(pane)` tells whether a dragged pane can open or join the
second column: the dock must be `double`, expanded, and hold another slot.
Until the column is open, its drop zone is a 48px band just past the inner
edge.

By default each pane of a dock is its own
[toned area](./pane.md), so the two columns of a split dock can show two hues.
With `share-tone`, every pane in the dock, untoned ones included, takes one
tone: that of the first toned pane on screen, reading the primary column before
the secondary one and a group through its active tab. The read-only
`sharedTone` getter returns that tone, or `null` when `share-tone` is off or no
pane on screen is toned. A pane that leaves the dock returns to its own tone.

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
