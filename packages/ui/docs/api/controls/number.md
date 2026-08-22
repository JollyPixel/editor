# `jolly-number`

`jolly-number` edits an unbounded or bounded number. It implements the
[shared field API](../field/shared-field-api.md).

```html
<jolly-number label="Opacity" min="0" max="1" step="0.01"></jolly-number>
```

| Property | Type | Default |
|---|---|---|
| `step` | `number` | `1` |
| `min` | `number` | `-Infinity` |
| `max` | `number` | `Infinity` |
| `value` | `number \| typeof Mixed` | `0` |

Typed input accepts decimal and scientific literals, parentheses, unary signs,
and the `+`, `-`, `*`, and `/` operators. Arrow keys commit one step. Shift
multiplies the step by ten; Alt divides it by ten.

Pointer scrubbing emits `jolly-input` during movement and `jolly-change` on
release. Enter or blur commits typed input. Escape discards the draft.
