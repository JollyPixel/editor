# `jolly-icon`

`jolly-icon` renders a glyph from the package icon registry.

```html
<jolly-icon name="search"></jolly-icon>
<jolly-icon name="close" label="Close panel"></jolly-icon>
```

| Property | Type | Default |
|---|---|---|
| `name` | `IconName` | `""` |
| `label` | `string` | `""` |
| `tone` | `IconTone | ""` | `""` |
| `onFill` (`on-fill`) | `boolean` | `false` |

An empty label marks the icon as decorative. A non-empty label gives it an
accessible image role. Glyphs use `currentColor`; `--jolly-icon-size` controls
their rendered size.

`tone` overrides the glyph's [registered tone](./registry.md#tones). Set
`on-fill` when the icon sits on an accent fill, so the tone uses its lighter
stop.

| Custom property | Default |
|---|---|
| `--jolly-icon-tone-rest` | `55%` |
| `--jolly-icon-tone-engaged` | `100%` |
| `--jolly-icon-tone-strength` | `--jolly-icon-tone-rest` |

`--jolly-icon-tone-strength` is how much of the tone a glyph shows. Hosts raise
it to the engaged stop on hover and selection; set `--jolly-icon-tone-rest` to
`100%` on a scope for colour that is always on.
