# Controls

The package provides thirteen custom elements. Nine are fields and share the contract in
[fields.md](./fields.md); the remaining elements are layout, action or panel components.

All tags are included in `HTMLElementTagNameMap`.

## Anchored popups

`PopoverController` places a native popover against a trigger. The host renders the popup and the
trigger declaratively, so the platform supplies the top layer, light dismiss and Escape; the
controller adds anchored placement, repositioning while open, focus restoration, and an `onCancel`
hook for hosts that treat Escape as a cancel.

```ts
#popup = new PopoverController(this, {
  anchor: () => this._button,
  popover: () => this._panel
});
```

```html
<button popovertarget="panel"></button>
<div id="panel" popover
  @beforetoggle=${this.#popup.onBeforeToggle}
  @toggle=${this.#popup.onToggle}
></div>
```

It knows nothing about what the popup contains. `jolly-color` is one consumer; an editor wanting a
brush swatch that opens `jolly-color-picker` with no property row is another, and composes the two
directly rather than reaching for `jolly-color`.

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

Hex color row: a swatch button that opens `jolly-color-picker` in a popup, plus a draftable hex
field.

| Property | Type | Default |
|---|---|---|
| `alpha` | `boolean` | `false` |

Accepts `#ff6600`, `ff6600`, `#f60` and `f60`, and normalizes to lowercase six-digit hex. With
`alpha` set it also accepts and emits `#rrggbbaa`. Four-digit `#rgba` is rejected on purpose: it
cannot be told apart from `#ff66`, which is what typing `#ff6600` looks like halfway through.

With `alpha` off, an eight-digit value still parses but its alpha is dropped on commit, so a row
showing no alpha affordance never emits one.

The popup renders in the top layer, so a scrolling pane cannot clip it. **Escape cancels**,
restoring the color held when the popup opened; clicking away, re-clicking the swatch and Enter
all accept. That asymmetry is the only cancel a popup picker has, because the picker commits
continuously while you drag.

```html
<jolly-color label="Tint" alpha></jolly-color>
```

### `jolly-color-picker`

The picker panel on its own. It is **not a field**: no label, `default`, `Mixed`, revert or
`lockedBy`, because those belong to the row hosting it. Use it directly wherever a picker is
wanted without a property row.

| Property | Type | Default |
|---|---|---|
| `value` | `string` | `"#000000"` |
| `alpha` | `boolean` | `false` |
| `hexInput` (`hex-input`) | `boolean` | `true` |
| `disabled` | `boolean` | `false` |
| `readonly` | `boolean` | `false` |

It emits `jolly-input` continuously while dragging and `jolly-change` on release, both carrying
`JollyChangeDetail<string>`, so a consumer writes the value back exactly as it would for a field.
`jolly-color` sets `hexInput` to `false`, since its row already carries a hex field.

Saturation and value are two visually hidden range inputs inside a labelled group, so keyboard
input, value announcement and forced-colors rendering all come from the platform; hue and alpha
are range inputs too, sharing `jolly-slider`'s handle geometry.

The alpha ramp carries an editable numeric readout, laid out as the slider's lane and value
column. It quantises to `0.01`. Blank or unparsable input cancels the edit rather than reporting
an error, since the ramp beside it still shows the value that survived.

The panel keeps its own hue and saturation rather than deriving them from `value` on every render.
Hex cannot express hue at black, white or grey, so a derived picker would snap the hue handle to
red the moment you dragged into a corner. It re-reads `value` only when the incoming color differs
from what it would emit, which is what lets a remote edit or a revert still move the handles.

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
