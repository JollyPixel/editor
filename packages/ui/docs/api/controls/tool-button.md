# `jolly-tool-button`

`jolly-tool-button` is a square icon button for rails and floating toolbars.
It can hold a flyout with related options.

```html
<jolly-tool-button icon="plus" label="Add" flyout-side="above">
  <jolly-tool-button slot="flyout" icon="close" label="Remove"></jolly-tool-button>
</jolly-tool-button>
```

| Property | Type | Default |
|---|---|---|
| `icon` | `IconName \| undefined` | `undefined` |
| `label` | `string` | `""` |
| `active` | `boolean` | `false` |
| `disabled` | `boolean` | `false` |
| `flyoutSide` (`flyout-side`) | `"above" \| "below" \| "left" \| "right"` | `"right"` |
| `open` | `boolean` | `false` |

The default slot renders after the icon; leave `icon` unset to show only
slotted content, for example a number. `label` is the
accessible name and the tooltip; the tooltip opens on `flyout-side`.

Content in the `flyout` slot turns the button into a flyout trigger and adds a
notch that points towards `flyout-side`. The flyout:

- opens on mouse hover, and on click for touch, pen and keyboard;
- stays open while a press that started inside it is held, so a slider can be
  dragged past its edge;
- closes on pointer leave, focus leaving the button, Escape, or a click on an
  enabled `button`, `jolly-button` or `jolly-tool-button` inside it.

`active` shows the accent fill and sets `aria-pressed` on buttons without a
flyout. `show()` and `hide()` open and close the flyout programmatically;
`show()` does nothing without flyout content or while disabled.

| Part | Element |
|---|---|
| `button` | the square button |
| `notch` | the arrow pointing towards the flyout |
| `tooltip` | the label tooltip |
| `flyout` | the flyout panel |

| Custom property | Default |
|---|---|
| `--jolly-tool-button-size` | `36px` |
| `--jolly-tool-button-gap` | `6px` |
