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
- `peerColor(index)` returns a collaborator color.

`ThemeMode` is `"light" | "dark" | "auto"`. `Density` is
`"compact" | "default" | "comfortable"`.

Components consume semantic properties such as `--jolly-surface`,
`--jolly-text`, `--jolly-control-bg`, `--jolly-accent-fill`,
`--jolly-danger`, and `--jolly-divider`. Layout properties include
`--jolly-label-width`, `--jolly-field-trailing-width`,
`--jolly-gutter-width`, and `--jolly-dock-size`.
