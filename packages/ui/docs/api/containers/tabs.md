# `jolly-tabs`

`jolly-tabs` renders direct [`jolly-tab`](./tab.md) children as an accessible
tab set.

```html
<jolly-tabs value="build">
  <jolly-tab value="build" label="Build">Build settings</jolly-tab>
  <jolly-tab value="paint" label="Paint">Paint settings</jolly-tab>
</jolly-tabs>
```

## Properties

```ts
interface Tabs {
  value: string;
  orientation: "horizontal" | "vertical"; // default "horizontal"
  variant: "default" | "skew"; // default "default"
  reorderable: boolean;
}
```

- An absent, disabled or unknown `value` selects the first enabled tab, once
  the tabs are slotted. A value set before that is kept.
- A tab appended in the same turn as the value selecting it stays selected.

## Events

```ts
interface TabsEvents {
  "jolly-tab-change": { value: string; }; // user selection
  "jolly-tab-close": { value: string; };
  "jolly-tab-action": { value: string; };
  "jolly-tab-reorder": { value: string; index: number; };
}
```

The element never removes or moves a tab itself: the listener does.

## Keyboard

Home, End and the arrow keys of the orientation move between enabled tabs.

## Closable tabs

- A `closable` tab has a close button inside it. It is skipped by keyboard
  focus.
- Clicking it, or middle-clicking the tab, emits `jolly-tab-close` and does not
  select the tab.

```js
tabs.addEventListener("jolly-tab-close", (event) => {
  const closed = [...tabs.querySelectorAll("jolly-tab")].find(
    (tab) => tab.value === event.detail.value
  );
  closed?.remove();
});
```

## Reordering

- In a `reorderable` set, the user drags a tab along the strip. The other tabs
  slide aside.
- Dropping emits `jolly-tab-reorder`. `index` is the position the tab asks for.
- Move the `jolly-tab` before the listener returns, and it glides into place.
  A listener that moves nothing, or Escape, slides every tab back.
- A `fixed` tab cannot be dragged and keeps its index.

```js
tabs.addEventListener("jolly-tab-reorder", (event) => {
  const tabList = [...tabs.querySelectorAll("jolly-tab")];
  const moved = tabList.find((tab) => tab.value === event.detail.value);
  const rest = tabList.filter((tab) => tab !== moved);
  tabs.insertBefore(moved, rest[event.detail.index] ?? null);
});
```

## Tab actions

- A tab with an `action` icon has a secondary button inside it.
- Clicking it emits `jolly-tab-action` and does not select the tab.
- It shows on the selected tab and on disabled tabs, stays enabled on a
  disabled tab, and is skipped by keyboard focus.

```html
<jolly-tab value="grass" label="grass" badge="12" action="pencil" action-label="Edit"></jolly-tab>
```

## Trailing controls

The `list-end` slot sits after the last tab, outside the scroll area, so it
stays visible when the tabs overflow.

```html
<jolly-tabs>
  <jolly-tab value="grass" label="grass"></jolly-tab>
  <jolly-button slot="list-end" icon="plus" icon-only label="Add"></jolly-button>
</jolly-tabs>
```

With empty panels, `jolly-tabs` works as a plain strip: the panel area
collapses to zero height.

## Skew variant

`variant="skew"` draws taller tabs as a chain of parallelograms, for a
horizontal strip at the start of its row. A `list-end` control joins the chain.

```css
jolly-tabs {
  --jolly-tab-skew: 8px; /* horizontal run of the slant */
  --jolly-tab-skew-seam: 2px; /* gap between two tabs */
}
```

## Parts

- `strip`: the tab list plus the `list-end` slot.
- `list`: the scrollable tablist.
- `tab`, `tab-selected`, `tab-dragging`: a tab item, with its buttons.
- `badge`: the badge chip.
- `action`, `action-selected`: the action button.
- `close`, `close-selected`: the close button.
- `modified`, `busy`, `failed`: the status marks.

Tabs size to their label. Stretch them with:

```css
jolly-tabs::part(tab) {
  flex: 1 1 0;
}
```

## Styling

A tab is at least `--jolly-control-height` tall. The strip has no resting
fill: hover tints neutral, selection tints with the accent and adds a 2px
accent bar.

```css
jolly-tabs {
  --jolly-tab-icon-size: 16px;
  --jolly-tab-close-size: 14px;
  --jolly-tab-close-icon-size: 8px;
  --jolly-tab-modified-size: 8px;
  --jolly-tab-status-size: 10px;
}
```

Colour tokens: `--jolly-tab-bg-hover`, `--jolly-tab-selected-bg`,
`--jolly-tab-selected-bg-hover`, `--jolly-tab-close-bg-hover`,
`--jolly-tab-close-fg-hover`, `--jolly-tab-badge-bg` and
`--jolly-tab-badge-fg`.
