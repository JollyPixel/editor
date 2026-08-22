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

An empty label marks the icon as decorative. A non-empty label gives it an
accessible image role. Glyphs use `currentColor`; `--jolly-icon-size` controls
their rendered size.
