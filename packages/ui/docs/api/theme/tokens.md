# Theme exports and tokens

The root entry point exports these theme styles and helpers:

- `themeStyles` applies theme tokens, density tokens, scales, font setup, and
  host selectors.
- `themeTokens`, `densityTokens`, and `scaleTokens` expose their individual Lit
  CSS results.
- `ensureFontFace()` registers the bundled Roboto Mono face.
- `fontFaceCss` contains its CSS declaration.
- `resolveThemeToken(element, name)` reads a resolved custom property.
- `resolveThemeColor(element, name, fallback)` resolves a color for canvas use.
- `resolveCssColor(element, value, fallback)` resolves a CSS color value, such
  as `light-dark()` or `var()`, for canvas use.
- `peerColor(index)` returns a collaborator color.
- `ambientThemeMode(element)` resolves the theme an element that declares
  tokens of its own should adopt: the surrounding scope, then the page's own
  scope host, then `null` when the page picked no side.
- `documentThemeMode(doc?)` resolves the page scope host's theme, for
  detached UI such as a floating window appended to the body.

`ThemeMode` is `"light" | "dark" | "auto"`. `Density` is
`"compact" | "default" | "comfortable"`.

Components consume semantic properties such as `--jolly-surface`,
`--jolly-text`, `--jolly-control-bg`, `--jolly-accent-fill`,
`--jolly-danger`, and `--jolly-divider`. Layout properties include
`--jolly-label-width`, `--jolly-label-max-width`,
`--jolly-field-trailing-width`, `--jolly-field-inset-start`,
`--jolly-field-inset-end`,
`--jolly-folder-indent`, `--jolly-gutter-width`, and `--jolly-dock-size`.

Seven tones add hue: `coral`, `amber`, `lime`, `teal`, `sky`, `violet` and
`pink`. Each has `--jolly-tone-<name>` for ink on a surface,
`--jolly-tone-<name>-on-fill` for ink over an accent fill, and
`--jolly-tone-<name>-fill` for a solid ground under white text. Inside a toned
[`jolly-pane`](../containers/pane.md), `--jolly-area-tone` and
`--jolly-area-fill` hold the pane's hue, and `--jolly-accent-fill`,
`--jolly-accent-text` and `--jolly-focus-ring` resolve to it.
