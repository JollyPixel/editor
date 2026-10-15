# `jolly-tab`

`jolly-tab` is one panel owned by [`jolly-tabs`](./tabs.md). The default slot
holds the panel content.

```html
<jolly-tab value="build" label="Build">Build settings</jolly-tab>
```

## Properties

```ts
interface Tab {
  label: string;
  value: string;
  disabled: boolean;
  closable: boolean; // adds a close button
  tooltip: string; // title of the tab button
  badge: string; // short chip after the label, such as a count
  action: IconName; // secondary button in the tab
  actionLabel: string; // attribute action-label
  icon: IconName;
  iconOnly: boolean; // attribute icon-only
  fixed: boolean; // keeps its place in a reorderable strip
  modified: boolean; // unsaved changes
  status: "idle" | "busy" | "failed"; // default "idle"

  active: boolean; // set by jolly-tabs
}
```

- `iconOnly` hides the label, which stays the accessible name and, without a
  `tooltip`, the title.
- `actionLabel` is the action's accessible name and tooltip.
- Events are raised by the parent, see [`jolly-tabs`](./tabs.md#events).

## Status marks

- `modified`: a closable tab shows a dot in place of its close glyph until
  hovered; other tabs show the dot after the label. Announced as "Unsaved
  changes".
- `status="busy"`: a spinner, and `aria-busy`. Announced as "Loading".
- `status="failed"`: a warning icon. Announced as "Failed to load".
- The status mark replaces the `modified` dot.
