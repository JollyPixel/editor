# Theming

`themeStyles` provides the UI tokens, density presets and scales. Apply it to a shadow-root scope
host; child components inherit the custom properties.

```ts
import { themeStyles } from "@jolly-pixel/ui";

class MyPane extends LitElement {
  static styles = [themeStyles, myPaneStyles];
}
```

Apply it to scope hosts only. A leaf that declares the token block also re-declares
`color-scheme`, which resets the scheme it should have inherited and drops that subtree back to
the OS preference while everything around it stays on the chosen theme.

## Theme and density

The `theme` attribute controls `color-scheme`:

```html
<my-pane theme="light"></my-pane>
<my-pane theme="dark"></my-pane>
```

Without an explicit value, the component follows the OS preference. `density` is inherited and
supports `compact`, `default` and `comfortable`.

| Preset | Row height | Font | Pitch |
|---|---:|---:|---:|
| `compact` | 16px | 10px | 20px |
| `default` | 20px | 11px | 24px |
| `comfortable` | 26px | 12px | 30px |

```html
<jolly-pane density="compact"></jolly-pane>
```

Rows carry no outer spacing. The container stacking them applies `--jolly-row-gap`, which is what
turns a row height into a pitch, and which lets a consumer stack fields flush.

## Typography

The package embeds Roboto Mono (weight 400, latin subset) and uses it at 11px throughout. It is
inlined as a `data:` URI because the package ships no asset pipeline.

`@font-face` is ignored inside a shadow root, so the face is registered against the document.
Importing `themeStyles` does this for you; call `ensureFontFace()` yourself if you declare tokens
by hand. Without registration `--jolly-font-family` falls back to the system mono stack.

```ts
import { ensureFontFace } from "@jolly-pixel/ui";

ensureFontFace();
```

## Semantic tokens

Override semantic tokens on the scope host or any consumer-owned ancestor:

```css
jolly-pane { --jolly-accent-fill: #ff6600; }
```

| Token | Use |
|---|---|
| `--jolly-surface`, `--jolly-surface-sunken`, `--jolly-surface-raised` | Opaque planes |
| `--jolly-ink`, `--jolly-ink-danger` | The inks control fills are mixed from |
| `--jolly-control-bg`, `-hover`, `-focus`, `-active`, `-muted` | Control states |
| `--jolly-dock-resize-bg`, `-hover` | Dock resize separator states |
| `--jolly-folder-header-bg`, `-hover`, `--jolly-pane-header-bg` | Container chrome hierarchy |
| `--jolly-invalid-bg`, `-hover`, `-focus` | Invalid control states |
| `--jolly-row-bg-focus` | Row tint locating the focused field |
| `--jolly-groove` | Slider tracks and scrollbars |
| `--jolly-divider` | Group-level rules |
| `--jolly-separator-label`, `--jolly-separator-rule` | Captioned separator emphasis |
| `--jolly-border`, `--jolly-border-strong` | Unused by the package; kept for consumers wanting outlines |
| `--jolly-text`, `--jolly-text-muted`, `--jolly-text-on-fill` | Text |
| `--jolly-accent-fill`, `-hover`, `-focus`, `--jolly-accent-text` | Accent surfaces and text |
| `--jolly-danger`, `--jolly-warning`, `--jolly-success` | Status text |
| `--jolly-modified`, `--jolly-locked` | Field indicators |
| `--jolly-shadow-overlay`, `--jolly-shadow-floating`, `--jolly-shadow-modal` | Elevation |
| `--jolly-axis-x`, `--jolly-axis-y`, `--jolly-axis-z` | Vector-field axis chips |

The package also exposes neutral, accent, danger, warning and success ramp tokens. Prefer semantic
tokens in application CSS; ramp names may change between versions.

### How control fills work

Controls have no border. A control is separated from its surface by an ink composited over it at
an alpha stop, so one decision covers every state and a control stays coherent at any nesting
depth:

```css
--jolly-control-bg: color-mix(in oklab, var(--jolly-ink) 8%, transparent);
```

The neutral control stops are ordered because focus, hover, active and error share one channel:
rest 8%, hover 12%, focus 20%, active 26%, and error from 15%. Container chrome uses dedicated
semantic tokens instead: accent fill at 12% for folder headers and 18% on hover, then the solid
accent fill for pane headers. This distinguishes hierarchy through hue as well as fill strength
without coupling container chrome to interactive control states.

This carries one invariant. **Container bodies paint opaque or paint nothing; only leaves and
container chrome tint.** Two translucent body layers over each other drift lighter, so a container
body that tints will wash out everything inside it.

## Layout tokens

`--jolly-label-width` sets a shared label column so values line up down a pane. Set it on the
container:

```css
jolly-pane { --jolly-label-width: 10ch; }
```

`--jolly-gutter-width` reserves leading space for the lock affordance. It is `0` by
default, so a single-user pane pays no inset. A collaborative container opts its subtree in:

```css
jolly-dock[data-collaborative] { --jolly-gutter-width: 14px; }
```

That reservation is what stops a row from shifting when a peer takes or releases a lock. A lock
without it still renders, widening the row instead.

`--jolly-field-trailing-width` reserves a shared trailing column for reset and presence chrome.
It is `auto` by default. Set a fixed width on a container when stacked value controls must keep
the same trailing edge across those states:

```css
jolly-pane { --jolly-field-trailing-width: 48px; }
```

## Scales

The package defines spacing tokens `--jolly-space-1` through `--jolly-space-6`, radii
`--jolly-radius-sm` (2px, controls) and `--jolly-radius-md` (6px, planes), `--jolly-row-gap`,
`--jolly-folder-gap`, and motion tokens `--jolly-duration-fast`, `--jolly-duration-base` and
`--jolly-easing`. Durations become zero for reduced-motion users.

## Contrast

Control boundaries do not meet WCAG 1.4.11, and there is no focus ring. This is deliberate: the
design separates controls by fill rather than by outline. If you are building something with a
contractual accessibility requirement, restore outlines through `--jolly-border-strong` and
budget for an audit finding otherwise.

Under `forced-colors: active` the ink system is dropped for system colours, so Windows High
Contrast users get real boundaries back.

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
