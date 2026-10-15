# Theme exports and tokens

## Styles

- `themeStyles`: theme, density and scale tokens, the font and the host
  selectors, in one Lit `CSSResult`.
- `themeTokens`, `densityTokens`, `scaleTokens`: the parts on their own.
- `ensureFontFace()` registers the bundled Roboto Mono face. `fontFaceCss` is
  its CSS.

## Types

```ts
type ThemeMode = "light" | "dark" | "auto";
type Density = "compact" | "default" | "comfortable";
type ResolvedThemeMode = "light" | "dark";

const THEME_MODES: readonly ThemeMode[]; // frozen, in this order
const DENSITIES: readonly Density[];
```

## Reading tokens

### `resolveThemeToken(host: HTMLElement, name: string, fallback?: string): string`

The resolved value of a custom property.

### `resolveThemeColor(host: HTMLElement, name: string, fallback?: string): string`

A token resolved to a colour, for canvas use.

### `resolveCssColor(host: HTMLElement, value: string, fallback?: string): string`

Resolves a CSS colour value, such as `light-dark()` or `var()`, for canvas
use.

### `peerColor(index: number): string`

A collaborator colour.

## Following the page theme

An element that declares tokens of its own stops inheriting the scope around
it, and one appended to `document.body` never inherited one. These helpers
resolve the page theme for it. `jolly-dialog` and the facade's floating `Pane`
already use them.

### `ambientThemeMode(element: Element): ResolvedThemeMode | null`

The surrounding scope's theme, then the page's scope host, then `null` when
the page picked no side.

### `resolveAmbientTheme(element: Element): ResolvedThemeMode`

`ambientThemeMode()`, or the system colour scheme.

### `adoptAmbientTheme(element: Element, adopted: ResolvedThemeMode | null): ResolvedThemeMode | null`

Sets the element's `theme` attribute to its ambient theme, or removes it, and
returns the mode. Pass the result back on the next call, so a `theme` the
author set is left alone.

### `documentThemeMode(doc?: Document): ResolvedThemeMode | null`

The page scope host's theme, for detached UI such as a floating window.

### `AmbientThemeController`

```ts
new AmbientThemeController(host, options?: AmbientThemeControllerOptions)

interface AmbientThemeControllerOptions {
  onChange?: (mode: ResolvedThemeMode) => void;
}
```

- `follow()` adopts the ambient theme, again on every `theme` change in the
  document, until `stop()` or disconnection.
- With `onChange`, it reports `resolveAmbientTheme(host)` instead and leaves
  the host's `theme` alone, system scheme changes included.

### `DocumentTheme`

```ts
new DocumentTheme(doc?: Document)
```

For code outside a Lit element, such as a 3D scene.

- `mode`: `documentThemeMode(doc)`, or the system colour scheme.
- `follow(onChange)`: calls `onChange` on each change, returns a stop
  function.

## Semantic tokens

- Surfaces and ink: `--jolly-surface`, `--jolly-text`, `--jolly-control-bg`,
  `--jolly-accent-fill`, `--jolly-danger`, `--jolly-divider`.
- Layout: `--jolly-label-width`, `--jolly-label-max-width`,
  `--jolly-field-inset-start`, `--jolly-field-inset-end`,
  `--jolly-folder-indent`, `--jolly-gutter-width`, `--jolly-dock-size`.
- Axes: `--jolly-axis-<axis>` for `x`, `y`, `z`, `w` is a fill under white
  text. `--jolly-axis-<axis>-text` is the letter as ink on a surface.
- Backdrop: `--jolly-dialog-backdrop` mixes 28% of `--jolly-dialog-header-bg`
  into `--jolly-scrim`. A dialog redeclares it so it follows its intent or
  tone.

## Tones

Seven hues: `coral`, `amber`, `lime`, `teal`, `sky`, `violet`, `pink`. Each
has:

- `--jolly-tone-<name>`: ink on a surface.
- `--jolly-tone-<name>-on-fill`: ink over an accent fill.
- `--jolly-tone-<name>-fill`: a solid ground under white text.

A glyph's default tone is set at
[registration](../icon/registry.md#tones).

## Toned areas

A `jolly-pane` or `jolly-dialog` with a `tone`, or with an `icon` registered
with one, is a toned area. Inside it:

- `--jolly-area-tone` and `--jolly-area-fill` hold its hue.
- `--jolly-accent-fill`, `--jolly-accent-text` and `--jolly-focus-ring`
  resolve to that hue, so headers, folder headers, separators and
  accent-filled controls take it.
- An explicit `tone` wins over the icon's.
