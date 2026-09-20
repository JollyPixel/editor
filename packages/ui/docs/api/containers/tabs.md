# `jolly-tabs`

`jolly-tabs` renders direct `jolly-tab` children as an accessible tab set.

```html
<jolly-tabs value="build">
  <jolly-tab value="build" label="Build">Build settings</jolly-tab>
  <jolly-tab value="paint" label="Paint">Paint settings</jolly-tab>
</jolly-tabs>
```

| Property | Type | Default |
|---|---|---|
| `value` | `string` | `""` |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` |
| `variant` | `"default" \| "skew"` | `"default"` |

An absent, disabled, or unknown value selects the first enabled tab, once
the tabs are slotted; a value set before that is kept as requested. A tab
appended in the same turn as the value selecting it is picked up before the
next render, so it stays selected. User
selection emits `jolly-tab-change` with `{ value }`. Home, End, and the arrow
keys move between enabled tabs according to orientation.

## Closable tabs

A `closable` tab renders a close button inside the tab, sharing its
background, hover, and selected underline. Clicking it, or
middle-clicking the tab button, emits `jolly-tab-close` with `{ value }`
and does not select the tab. The element removes nothing: remove the
`jolly-tab` in the listener to close it. The close button is skipped by
keyboard focus.

```js
tabs.addEventListener("jolly-tab-close", (event) => {
  const closed = [...tabs.querySelectorAll("jolly-tab")].find(
    (tab) => tab.value === event.detail.value
  );
  closed?.remove();
});
```

## Tab actions

A tab with an `action` icon renders a secondary button inside the tab.
Clicking it emits `jolly-tab-action` with `{ value }` and does not select the
tab. The button shows on the selected tab and on disabled tabs, which cannot
be selected; it stays enabled on a disabled tab and is skipped by keyboard
focus.

```html
<jolly-tab value="grass" label="grass" badge="12" action="pencil" action-label="Edit"></jolly-tab>
```

## Trailing controls

The `list-end` slot sits right after the last tab and outside the list's
scroll area, so a control placed there follows the tabs and stays visible
when they overflow.

```html
<jolly-tabs>
  <jolly-tab value="grass" label="grass"></jolly-tab>
  <jolly-button slot="list-end" icon="plus" icon-only label="Add"></jolly-button>
</jolly-tabs>
```

A tab set with empty panels works as a plain tab strip: the panel area
collapses to zero height when `jolly-tabs` is not given one.

## Skew variant

`variant="skew"` draws taller tabs as a chain of parallelograms with a
resting fill, separated by slanted seams. A `list-end` control takes the same
shape and joins the chain. It is meant for a horizontal strip that floats at
the start of its row rather than filling it.

| Token | Applies to |
|---|---|
| `--jolly-tab-skew` | Horizontal run of the slant, `8px` |
| `--jolly-tab-skew-seam` | Gap between two chained tabs, `2px` |

## Parts

| Part | Node |
|---|---|
| `strip` | The tab list plus the `list-end` slot |
| `list` | The tablist, the scrollable part of the strip |
| `tab` | Every tab item, the label button plus its action and close buttons |
| `tab-selected` | The selected tab item, in addition to `tab` |
| `badge` | The badge chip of a tab |
| `action` | Every action button |
| `action-selected` | The action button of the selected tab, in addition to `action` |
| `close` | Every close button of a closable tab |
| `close-selected` | The close button of the selected tab, in addition to `close` |

The strip sizes each item to its label. Stretch them across the strip with:

```css
jolly-tabs::part(tab) {
  flex: 1 1 0;
}
```

## Theming

The strip has no resting fill: hover tints neutral, selection tints with the
accent and adds a 2px accent bar on the strip edge, so neither state reads as a
stronger version of the other.

| Token | Applies to |
|---|---|
| `--jolly-tab-bg-hover` | A hovered, unselected tab |
| `--jolly-tab-selected-bg` | The selected tab |
| `--jolly-tab-selected-bg-hover` | The selected tab, hovered |
| `--jolly-tab-close-bg-hover` | The round fill behind a hovered close button |
| `--jolly-tab-close-fg-hover` | The glyph of a hovered close button |
| `--jolly-tab-badge-bg` | The badge chip fill, an amber tint |
| `--jolly-tab-badge-fg` | The badge text, amber adapted to the theme |
