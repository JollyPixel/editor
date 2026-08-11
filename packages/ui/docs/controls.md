# Controls

The package provides twelve custom elements. Nine are fields and share the contract in
[fields.md](./fields.md); the remaining elements are layout or action components.

All tags are included in `HTMLElementTagNameMap`.

## Fields

### `jolly-text`

String input.

| Property | Type | Default |
|---|---|---|
| `placeholder` | `string` | `""` |

`jolly-input` fires for each keystroke.

### `jolly-number`

Numeric input with expression parsing, arrow-key stepping and drag scrubbing.

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `1` |
| `min` | `number` | `-Infinity` |
| `max` | `number` | `Infinity` |

Expressions support decimal/scientific literals, unary signs, parentheses and `+`, `-`, `*`,
`/`. `Shift` multiplies the step by ten and `Alt` divides it by ten. Scrubbing emits
`jolly-input`; typing and arrow keys commit with `jolly-change`.

### `jolly-slider`

Slider paired with an editable numeric field. The field accepts typed entry and commits on Enter
or blur, discarding on Escape, like `jolly-number`.

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `1` |
| `min` | `number` | `0` |
| `max` | `number` | `100` |

Dragging emits `jolly-input`; releasing the drag, and typing into the field, commit with
`jolly-change`.

The track is a fine groove filled to the current value. It is the one control with no fill of its
own. Hover lightens the handle without changing geometry; focus thickens the track and grows the
handle. An invalid slider recolours the fill and handle to `--jolly-danger-border`.

### `jolly-range`

Two-ended numeric interval. `value` is an `Interval` with `from` and `to` fields.

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `1` |
| `min` | `number` | `0` |
| `max` | `number` | `100` |

The ends cannot cross; a commit beyond the other end is clamped. Arrow keys and `Shift`/`Alt`
stepping follow `jolly-number`.

A decorative capped span between the inputs identifies them as the endpoints of one interval.
It is hidden from assistive technology; each input retains its range-start or range-end name.

### `jolly-checkbox`

Boolean checkbox with native keyboard behavior and `indeterminate` support. `Mixed` renders as
indeterminate; activating it commits `true`.

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

Options are matched by position, so values may be objects or numbers. An option may also include
an icon; see [icons.md](./icons.md). Native dropdown rows use the raised theme surface so their
background follows both light and dark modes.

### `jolly-button-group`

Single-choice segmented or grid selector.

| Property | Type | Default |
|---|---|---|
| `options` | `JollyOption<T>[]` | `[]` |
| `layout` | `"segmented" \| "grid"` | `"segmented"` |
| `columns` | `number` | `0` (automatic) |

Uses one tab stop and arrow-key navigation. Disabled options are skipped.

### `jolly-flags`

Multi-select bitmask over `JollyOption<number>[]`. Each option's `value` must be one bit.

```ts
field.options = [
  { value: 1, label: "Default" },
  { value: 2, label: "Player" },
  { value: 4, label: "Terrain" }
];
field.value = 0b101;
```

Values are treated as unsigned 32-bit masks. Each option has its own tab stop.

### `jolly-color`

Hex color input with a native color swatch. Accepts `#ff6600`, `ff6600`, `#f60` and `f60`, and
normalizes to lowercase six-digit hex. Alpha is not supported.

## Action and layout elements

### `jolly-button`

Slotted action button. It is not a field and has no `value`, `default` or field events.

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

Visual separator between groups. The optional `label` captions it; an unlabeled separator is
hidden from assistive technology.

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
