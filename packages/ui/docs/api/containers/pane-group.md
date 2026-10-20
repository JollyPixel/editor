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

## Properties

```ts
interface PaneGroup {
  // layoutKey of the shown pane, default the first enabled pane.
  active: string;
}
```

## Events

```ts
interface PaneGroupEvents {
  "jolly-tab-change": { value: string; }; // a tab was selected
}
```

Inside a dock layout, selecting a tab also reports a
[`GroupChange`](./layout.md#layoutchange).

## Methods

### `panes(): PaneElement[]`

The slotted panes.

### `activePane(): PaneElement | null`

The shown pane.

## Tabs

- Each tab shows the pane `icon` and `heading`, or its `layoutKey` when the
  heading is empty.
- Click, Left, Right, Home or End selects a tab.
- The tab of a `disabled` pane is skipped. An `active` naming one falls back to
  the first enabled pane.
- When the strip is too narrow, tabs with an icon show only the icon and get
  `data-icon-only`. Tabs without an icon truncate, with an
  [overflow title](../interaction/overflow-titles.md).
- Tabs size to their label. Stretch them with
  `jolly-pane-group::part(tab) { flex: 1 1 0; }`.
- When the shown pane has a [tone](../theme/tokens.md#toned-areas), the strip
  takes its fill and the selected tab is underlined in a shade of it.

## Grouped panes

- Grouped panes get `grouped`, which hides their title, fold and grip.
- Hidden panes get `inactive`.
- A grouped pane shows its header only when it has `actions`.
- Its content stays visible while `collapsed`.

## In a dock layout

- The layout creates and removes groups while it projects the snapshot.
- A group left with one pane is replaced by that pane.
- Dragging a tab moves that pane only. Along its own strip the other tabs slide
  aside. Off the strip, the dock layout shows its drop zones.
- Space on a focused tab starts a [keyboard move](./dock-layout.md#keyboard-moves).

## Parts

`tabs`, `tab`, `tab-selected`, `tab-icon`, `tab-label`, `panels`.
