# `jolly-slider`

`jolly-slider` combines a native range with an editable numeric readout. It
implements the [shared field API](../field/shared-field-api.md).

```html
<jolly-slider label="Opacity" min="0" max="1" step="0.01"></jolly-slider>
```

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `1` |
| `min` | `number` | `0` |
| `max` | `number` | `100` |
| `value` | `number \| typeof Mixed` | `0` |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` |

Range movement emits `jolly-input`; release emits `jolly-change`. Enter or
blur commits typed numeric input. The readout accepts the same expression
grammar as `jolly-number`.

A vertical slider stands the lane upright, with the maximum at the top and the
readout above it. An empty `label` hides the label line. Set
`--jolly-slider-length` to change the lane height (default `120px`).

```html
<jolly-slider orientation="vertical" min="1" max="8"></jolly-slider>
```
