# `jolly-pane-group`

`jolly-pane-group` stacks several panes in one place and shows one at a time
behind a tab strip.

```html
<jolly-dock key="left" side="left">
  <jolly-pane-group active="blocks">
    <jolly-pane key="general" heading="General"></jolly-pane>
    <jolly-pane key="blocks" heading="Blocks"></jolly-pane>
  </jolly-pane-group>
</jolly-dock>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `active` | `active` | `string` | First pane |

`active` is the `layoutKey` of the shown pane. The default slot accepts
`jolly-pane` children. Each tab is labelled with the pane `heading`, or its
`layoutKey` when the heading is empty, and starts with the pane `icon` when it
has one. Grouped panes get `grouped`, which hides their title, fold and grip,
and the hidden ones get `inactive`. A grouped pane shows its header only when it
has `actions`, and its content stays visible while `collapsed`.

Selecting a tab with a click, Left, Right, Home or End emits
`jolly-tab-change` with `{ value }`. Inside a dock layout it also reports a
`GroupChange`. The tab of a `disabled` pane is skipped by both, and an `active`
naming one falls back to the first enabled pane.

Inside a `jolly-dock-layout`, the layout creates and removes groups while it
projects the snapshot. A group left with one pane is replaced by that pane.
Dragging a tab moves that pane only, and Space on a focused tab starts a
keyboard move, the same as a pane grip.

`occupiedSize(axis)`, `tabsRect()`, `tabCandidates()` and `tabLine(index)`
serve drop resolution. `panes()` returns the slotted panes and `activePane()`
the shown one. The component exposes `tabs`, `tab`, `tab-selected`, `tab-icon`,
`tab-label`, and `panels` CSS parts. Tabs size to their label; stretch them
across the strip with `jolly-pane-group::part(tab) { flex: 1 1 0; }`.
