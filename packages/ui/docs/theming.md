# Theming

`themeStyles` provides the UI tokens, density presets and scales. Apply it to a shadow-root scope
host; child components inherit the custom properties.

```ts
import { themeStyles } from "@jolly-pixel/ui";

class MyPane extends LitElement {
  static styles = [themeStyles, myPaneStyles];
}
```

## Theme and density

The `theme` attribute controls `color-scheme`:

```html
<my-pane theme="light"></my-pane>
<my-pane theme="dark"></my-pane>
```

Without an explicit value, the component follows the OS preference. `density` is inherited and
supports `compact`, `default` and `comfortable`.

| Preset | Row height | Font |
|---|---:|---:|
| `compact` | 18px | 11px |
| `default` | 22px | 12px |
| `comfortable` | 28px | 13px |

```html
<jolly-pane density="compact"></jolly-pane>
```

## Semantic tokens

Override semantic tokens on the scope host or any consumer-owned ancestor:

```css
jolly-pane { --jolly-accent-fill: #ff6600; }
```

| Token | Use |
|---|---|
| `--jolly-surface`, `--jolly-surface-sunken`, `--jolly-surface-raised` | Surfaces |
| `--jolly-control-bg`, `--jolly-control-bg-hover`, `--jolly-control-bg-active` | Control states |
| `--jolly-border`, `--jolly-border-strong` | Dividers and control outlines |
| `--jolly-text`, `--jolly-text-muted`, `--jolly-text-on-fill` | Text |
| `--jolly-accent-fill`, `--jolly-accent-text` | Accent surfaces and text |
| `--jolly-focus-ring` | Focus outline |
| `--jolly-danger`, `--jolly-warning`, `--jolly-success` | Status text |
| `--jolly-danger-border` | Invalid-control border |
| `--jolly-modified`, `--jolly-locked` | Field indicators |
| `--jolly-shadow-overlay`, `--jolly-shadow-floating`, `--jolly-shadow-modal` | Elevation |
| `--jolly-axis-x`, `--jolly-axis-y`, `--jolly-axis-z` | Vector-field axis chips |

The package also exposes neutral, accent, danger, warning and success ramp tokens. Prefer semantic
tokens in application CSS; ramp names may change between versions.

## Scales

The package defines spacing tokens `--jolly-space-1` through `--jolly-space-6`, radii
`--jolly-radius-sm` and `--jolly-radius-md`, and motion tokens `--jolly-duration-fast`,
`--jolly-duration-base` and `--jolly-easing`. Durations become zero for reduced-motion users.

## Peer colors

```ts
import { peerColor } from "@jolly-pixel/ui";

element.style.background = peerColor(peerIndex);
```

`peerColor()` returns a distinct collaborator color for a peer index.

## Scope hosts and fallbacks

Components consume theme tokens but do not define the palette themselves. A component outside a
scope host still renders with limited fallbacks and warns once per tag name when the theme is
missing.
