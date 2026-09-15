# `jolly-color-picker`

`jolly-color-picker` is a standalone saturation, value, hue, and alpha picker.
It does not use the shared field row.

```html
<jolly-color-picker value="#4488ff" alpha></jolly-color-picker>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `value` | `value` | `string` | `"#000000"` |
| `alpha` | `alpha` | `boolean` | `false` |
| `hexInput` | `hex-input` | `boolean` | `true` |
| `layout` | `layout` | `"stack" \| "wide"` | `"stack"` |
| `disabled` | `disabled` | `boolean` | `false` |
| `readonly` | `readonly` | `boolean` | `false` |

Pointer and range-input movement emits `jolly-input`. Release or a committed
text edit emits `jolly-change`. Both events carry `{ value: string }`.
`focus()` moves focus to the saturation range.

## Layouts

`"stack"` is a 180px column: the saturation and value area, a horizontal hue
track, the alpha track with its 0 to 1 readout, and the hex footer.

`"wide"` is a row that fills its host's height: the area, a vertical hue
track, a vertical alpha track when `alpha` is set, then a grid of channel
fields. The grid holds R, G, B (0 to 255), H (0 to 360), HSL S and L (0 to
100), and a footer with the preview, the hex field and, with `alpha`, an A
field (0 to 100). Give the element a height; the area grows up to
`--jolly-picker-area-max-width` (280px).

```html
<jolly-color-picker layout="wide" alpha style="height: 120px"></jolly-color-picker>
```

Channel fields accept numeric expressions, commit on Enter or blur, clamp to
their range, and discard the draft on Escape. An unparsable entry sets
`aria-invalid` and commits nothing. Hue and saturation are held across edits
that reach black or gray.
