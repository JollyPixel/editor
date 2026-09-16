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

A tab set with empty panels works as a plain tab strip: the panel area
collapses to zero height when `jolly-tabs` is not given one.

## Parts

| Part | Node |
|---|---|
| `list` | The tablist strip |
| `tab` | Every tab item, the label button plus its close button |
| `tab-selected` | The selected tab item, in addition to `tab` |
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
