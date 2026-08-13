# Theming

`themeStyles` provides UI tokens, density presets, and scales. Apply it to a shadow-root scope
host so child components inherit its custom properties:

```ts
import { themeStyles } from "@jolly-pixel/ui";

class MyPane extends LitElement {
  static styles = [themeStyles, myPaneStyles];
}
```

Apply it to scope hosts, not leaf components. A leaf token block resets its `color-scheme` and can
break inherited theme selection.

## Theme and density

Set `theme="light"` or `theme="dark"` on the scope host. Without it, the host follows the OS
preference. `density` is inherited and accepts `compact`, `default`, or `comfortable`.

`jolly-theme-preferences` composes the theme and density controls, applies them to its nearest
`jolly-scope`, and persists them when given a `storage-key`:

```html
<jolly-scope>
  <jolly-theme-preferences storage-key="editor:appearance"></jolly-theme-preferences>
  <!-- themed UI -->
</jolly-scope>
```

Set its `target` property when another element owns `themeStyles`. Its `storage` property accepts
a `StorageAdapter`; `defaultTheme` and `defaultDensity` configure the fallback values.

| Preset | Row height | Font | Pitch |
|---|---:|---:|---:|
| `compact` | 16px | 10px | 20px |
| `default` | 20px | 11px | 24px |
| `comfortable` | 26px | 12px | 30px |

```html
<jolly-pane theme="dark" density="compact"></jolly-pane>
```

## Typography

The package uses Roboto Mono at 11px. `themeStyles` registers the bundled font face. Call
`ensureFontFace()` only when declaring theme tokens without `themeStyles`.

```ts
import { ensureFontFace } from "@jolly-pixel/ui";

ensureFontFace();
```

## Semantic tokens

Override semantic tokens on a scope host or consumer-owned ancestor:

```css
jolly-pane { --jolly-accent-fill: #ff6600; }
```

| Token | Use |
|---|---|
| `--jolly-surface`, `--jolly-surface-sunken`, `--jolly-surface-raised` | Opaque planes |
| `--jolly-ink`, `--jolly-ink-danger` | Control fills |
| `--jolly-control-bg`, `-hover`, `-focus`, `-active`, `-muted` | Control states |
| `--jolly-dock-resize-bg`, `-hover` | Dock resize states |
| `--jolly-folder-header-bg`, `-hover`, `--jolly-pane-header-bg` | Container chrome |
| `--jolly-invalid-bg`, `-hover`, `-focus` | Invalid controls |
| `--jolly-row-bg-focus` | Focused field row |
| `--jolly-groove`, `--jolly-divider` | Tracks, scrollbars, and group rules |
| `--jolly-separator-label`, `--jolly-separator-rule` | Separator captions |
| `--jolly-border`, `--jolly-border-strong` | Consumer outlines |
| `--jolly-text`, `--jolly-text-muted`, `--jolly-text-on-fill` | Text |
| `--jolly-accent-fill`, `-hover`, `-focus`, `--jolly-accent-text` | Accent surfaces and text |
| `--jolly-danger`, `--jolly-warning`, `--jolly-success` | Status text |
| `--jolly-modified`, `--jolly-locked` | Field indicators |
| `--jolly-shadow-overlay`, `--jolly-shadow-floating`, `--jolly-shadow-modal` | Elevation |
| `--jolly-axis-x`, `--jolly-axis-y`, `--jolly-axis-z` | Vector-field axis chips |

Neutral, accent, danger, warning, and success ramp tokens are also available. Prefer semantic
tokens in application CSS because ramp names can change between versions.

## Layout tokens

Set these on a containing element when rows should align:

```css
jolly-pane {
  --jolly-label-width: 10ch;
  --jolly-field-trailing-width: 48px;
}
```

`--jolly-label-width` aligns field labels. `--jolly-field-trailing-width` reserves space for
optional revert and presence controls. `--jolly-gutter-width` reserves leading space for
collaboration locks; it defaults to `0`. `--jolly-dock-size` sets a dock's width (`left`/`right`)
or height (`top`/`bottom`), defaulting to `240px`; setting it on `jolly-dock` directly beats its
own `:host` rule where a plain `width`/`height` override would lose on specificity.

The package also defines `--jolly-space-1` through `--jolly-space-6`, `--jolly-radius-sm`,
`--jolly-radius-md`, `--jolly-row-gap`, `--jolly-folder-gap`, and motion tokens
`--jolly-duration-fast`, `--jolly-duration-base`, and `--jolly-easing`. Motion durations become
zero for users who prefer reduced motion.

## Contrast

Controls use fill changes instead of outlines. If your product requires explicit control
boundaries, define an outline with `--jolly-border-strong` and include it in your accessibility
review. Under `forced-colors: active`, components use system colors.

## Peer colors

```ts
import { peerColor } from "@jolly-pixel/ui";

element.style.background = peerColor(peerIndex);
```

`peerColor()` returns a collaborator color for a peer index.

## Scope hosts and fallbacks

Components outside a scope host render with limited fallbacks and warn once per tag name.
