# Controls

Nine controls are fields and share the contract in [fields.md](./fields.md). The others are action
or layout elements. All tags are included in `HTMLElementTagNameMap`.

## Anchored popups

`PopoverController` adds anchored placement, repositioning, focus restoration, and optional Escape
cancellation to a native popover:

```ts
#popup = new PopoverController(this, {
  anchor: () => this._button,
  popover: () => this._panel
});
```

It does not constrain popup content. `jolly-color` uses it, and custom controls can compose it
with `jolly-color-picker` directly.

## Fields

### `jolly-text`

String input. `placeholder` defaults to `""`; `jolly-input` fires for each keystroke.

### `jolly-number`

Numeric input with expression parsing, arrow-key stepping, and drag scrubbing.

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `1` |
| `min` | `number` | `-Infinity` |
| `max` | `number` | `Infinity` |

It accepts decimal and scientific literals, parentheses, unary signs, and `+`, `-`, `*`, `/`.
Shift multiplies the step by ten; Alt divides it by ten. Scrubbing emits `jolly-input`; typing and
arrow keys commit with `jolly-change`.

### `jolly-slider`

Slider with an editable numeric input. It accepts the same typed editing behavior as
`jolly-number`.

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `1` |
| `min` | `number` | `0` |
| `max` | `number` | `100` |

Dragging emits `jolly-input`; releasing or committing typed input emits `jolly-change`.

### `jolly-range`

Two-ended numeric interval. `value` is an `Interval` with `from` and `to`.

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `1` |
| `min` | `number` | `0` |
| `max` | `number` | `100` |

Ends cannot cross; a value beyond the other endpoint is clamped. Keyboard stepping follows
`jolly-number`.

### `jolly-checkbox`

Boolean checkbox with native keyboard behavior and `indeterminate` support. `Mixed` renders as
indeterminate and activation commits `true`. Set `align="end"` for trailing placement.

| Property | Attribute | Type | Default |
|---|---|---|---|
| `clickableBackground` | `clickable-background` | `boolean` | `false` |

Set `clickable-background` to make the value area activate the checkbox.

### `jolly-select`

Single-choice native select.

| Property | Type | Default |
|---|---|---|
| `options` | `JollyOption<T>[]` | `[]` |

```ts
field.options = [
  { value: "nearest", label: "Nearest" },
  { value: "linear", label: "Linear", disabled: true }
];
```

Options are position-matched, so values may be objects or numbers. Options can also use an icon;
see [icons.md](./icons.md).

### `jolly-button-group`

Single-choice segmented or grid selector.

| Property | Type | Default |
|---|---|---|
| `options` | `JollyOption<T>[]` | `[]` |
| `layout` | `"segmented" \| "grid"` | `"segmented"` |
| `columns` | `number` | `0` (automatic) |

It uses one tab stop and arrow-key navigation. Disabled options are skipped.

### `jolly-flags`

Multi-select bitmask over `JollyOption<number>[]`. Each option value must be one bit.

```ts
field.options = [
  { value: 1, label: "Default" },
  { value: 2, label: "Player" },
  { value: 4, label: "Terrain" }
];
field.value = 0b101;
```

Values are unsigned 32-bit masks. Each option has its own tab stop.

### `jolly-color`

Color field with a swatch popup and editable hex input.

| Property | Type | Default |
|---|---|---|
| `alpha` | `boolean` | `false` |

It accepts `#ff6600`, `ff6600`, `#f60`, and `f60`, then normalizes to lowercase six-digit hex.
With `alpha`, it also accepts and emits `#rrggbbaa`. Escape restores the color from when the popup
opened; clicking away, re-clicking the swatch, and Enter accept the current value.

```html
<jolly-color label="Tint" alpha></jolly-color>
```

### `jolly-color-picker`

Standalone picker panel. It is not a field, so it has no label, `default`, `Mixed`, revert, or
collaboration state.

| Property | Type | Default |
|---|---|---|
| `value` | `string` | `"#000000"` |
| `alpha` | `boolean` | `false` |
| `hexInput` (`hex-input`) | `boolean` | `true` |
| `disabled` | `boolean` | `false` |
| `readonly` | `boolean` | `false` |

It emits `jolly-input` while dragging and `jolly-change` on release. `jolly-color` sets
`hexInput` to `false` because its row includes a hex field.

## Action and layout elements

### `jolly-controls` and `jolly-control`

A declarative HUD card for scene controls. `jolly-controls` is positioned absolutely, so place it
inside a positioned scene wrapper. Its `max-entries-per-row` is a maximum: constrained containers
reduce the count to preserve readable descriptions.

| Property | Type | Default |
|---|---|---|
| `position` | `ControlsPosition` | `"bottom-left"` |
| `maxEntriesPerRow` (`max-entries-per-row`) | `number` | `3` |
| `heading` | `string` | `""` |

`position` accepts `top-left`, `top-middle`, `top-right`, `middle-left`, `middle`,
`middle-right`, `bottom-left`, `bottom-middle`, and `bottom-right`. The inset follows density and
can be overridden with `--jolly-controls-inset`.

Each `jolly-control` accepts one or more `kbd` elements, a short `description`, and optional
`details`. When details are present, an information button opens the full description on hover,
keyboard focus, or click. It closes on pointer or focus exit, and Escape is handled by the native
popover.

```html
<div class="scene">
  <jolly-controls
    position="bottom-left"
    max-entries-per-row="3"
    heading="Controls"
  >
    <jolly-control
      description="Move forward"
      details="Moves the player relative to the camera direction."
    ><kbd>W</kbd></jolly-control>
    <jolly-control description="Sprint"><kbd>Shift</kbd><kbd>W</kbd></jolly-control>
  </jolly-controls>
</div>
```

### `jolly-button`

Slotted action button. It is not a field and has no `value`, `default`, or field events.

| Property | Type | Default |
|---|---|---|
| `icon` | `IconName \| undefined` | none |
| `variant` | `"default" \| "accent" \| "danger"` | `"default"` |
| `disabled` | `boolean` | `false` |
| `label` | `string` | `""` |
| `iconOnly` | `boolean` | `false` |

```html
<jolly-button icon="revert">Reset all</jolly-button>
<jolly-button icon="close" label="Close" icon-only></jolly-button>
```

Use `label` when an icon-only button has no visible text.

### `jolly-separator`

Visual separator between groups. Its optional `label` adds a caption; an unlabeled separator is
hidden from assistive technology.

```html
<jolly-separator></jolly-separator>
<jolly-separator label="Rendering"></jolly-separator>
```

### `jolly-property-row`

Labeled row for slotted content that is not a field.

| Property | Type | Default |
|---|---|---|
| `label` | `string` | `""` |
| `description` | `string` | `""` |

```html
<jolly-property-row label="Export" description="Writes to the project folder">
  <jolly-button>PNG</jolly-button>
  <jolly-button>JSON</jolly-button>
</jolly-property-row>
```
