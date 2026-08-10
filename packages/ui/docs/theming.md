# Theming

Tokens are declared once, on a scope host, and consumed everywhere else. A leaf component reads
tokens and never declares them.

## Applying the theme

`themeStyles` carries the tokens, the density presets and the scales. Put it on whichever element
you designate as the scope, usually a pane, a dock or an application root:

```ts
import { themeStyles } from "@jolly-pixel/ui";

class MyPane extends LitElement {
  static styles = [themeStyles, myPaneStyles];
}
```

It declares against `:host`, so it needs a shadow root. An element outside any scope host still
renders, because components read tokens with fallbacks, but it will not follow the theme.

## Light and dark

The `theme` attribute only flips `color-scheme`, which is what `light-dark()` resolves against:

```html
<my-pane></my-pane>                <!-- follows the OS preference -->
<my-pane theme="light"></my-pane>
<my-pane theme="dark"></my-pane>
```

Two panes on one page can therefore carry different themes, which a document level stylesheet
could not support.

## Overriding

Custom properties inherit through shadow roots, so a consumer overrides with plain CSS and no
piercing:

```css
jolly-pane {
  --jolly-accent-fill: #ff6600;
}
```

Anything nested inside inherits the override.

## The two tiers

**Tier 1, ramps.** `--jolly-neutral-*`, `--jolly-accent-*`, `--jolly-danger-*`, `--jolly-warning-*`,
`--jolly-success-*`, authored in OKLCH so lightness steps are perceptually even. Components never
read these. CSS has no privacy so you can override them, but the mapping from a ramp step to a
semantic name is free to change between versions.

**Tier 2, semantics.** The names below are what components read and what you override. Each is one
`light-dark()` pair over two ramp steps, so the two themes differ by ramp index rather than by hand
picked colours and cannot drift into disagreeing about which of two surfaces is darker.

| Token | Use |
|---|---|
| `--jolly-surface`, `--jolly-surface-sunken`, `--jolly-surface-raised` | Panel backgrounds |
| `--jolly-control-bg`, `--jolly-control-bg-hover`, `--jolly-control-bg-active` | Control backgrounds, hover and press |
| `--jolly-border` | Dividers between surfaces |
| `--jolly-border-strong` | Outlines of interactive controls |
| `--jolly-text`, `--jolly-text-muted` | Values, and labels |
| `--jolly-text-on-fill` | Text over a filled background |
| `--jolly-accent-fill` | Background behind text |
| `--jolly-accent-text` | Accent coloured text and icons |
| `--jolly-focus-ring` | Focus outline |
| `--jolly-danger`, `--jolly-warning`, `--jolly-success` | Status text |
| `--jolly-danger-border` | Border of an invalid control |
| `--jolly-modified`, `--jolly-locked` | Revert affordance, and the lock ring fallback |
| `--jolly-shadow-overlay`, `-floating`, `-modal` | The three elevation levels |
| `--jolly-axis-x`, `-y`, `-z` | Vector field axis chips |

`--jolly-accent-fill` and `--jolly-accent-text` are separate because one value cannot do both jobs:
a colour that carries white text at 4.5:1 is too dark to read as text on the surface, and vice
versa.

`--jolly-border` is deliberately below 3:1. It divides surfaces, which WCAG 1.4.11 does not govern.
Anything outlining an interactive control uses `--jolly-border-strong`, which clears 3:1 against
both surfaces and both control backgrounds.

## Contrast

Targets, following WCAG 2.1, verified when the ramp steps were chosen:

| Pair | Target | Light | Dark |
|---|---|---|---|
| `--jolly-text` on `--jolly-surface` | 4.5:1 | 16.71 | 16.71 |
| `--jolly-text-muted` on `--jolly-surface` | 4.5:1 | 5.65 | 7.15 |
| `--jolly-text-on-fill` over `--jolly-accent-fill` | 4.5:1 | 4.77 | 4.77 |
| `--jolly-accent-text` on `--jolly-surface` | 4.5:1 | 6.59 | 10.12 |
| `--jolly-border-strong` on `--jolly-surface` | 3:1 | 3.72 | 4.49 |
| `--jolly-focus-ring` on `--jolly-surface` | 3:1 | 4.50 | 7.35 |
| `peerColor()`, worst of the first sixteen | 3:1 | 3.45 | 4.12 |

Overriding a colour token is your contrast to maintain. `--jolly-accent-fill` is the one to watch,
since `--jolly-text-on-fill` sits on top of it.

## Density

Three presets, set on the scope host. They inherit, so a nested pane may override its parent:

```html
<jolly-pane density="compact"></jolly-pane>
```

| Preset | Row height | Font |
|---|---|---|
| `compact` | 18px | 11px |
| `default` | 22px | 12px |
| `comfortable` | 28px | 13px |

Icon buttons and rails are a separate role at 32px and do not scale with density, because an 18px
pointer target is not usable.

## Scales

`--jolly-space-1` through `-6` on a 4px grid. Two radii, `--jolly-radius-sm` at 3px and
`--jolly-radius-md` at 5px. Two durations, `--jolly-duration-fast` at 100ms for hover and press and
`--jolly-duration-base` at 160ms for expand and reveal, with one `--jolly-easing`. Both durations
become zero under `prefers-reduced-motion: reduce`.

Always name the properties a transition applies to. `transition: all` repaints more than intended.

Numeric readouts should set `font-variant-numeric: var(--jolly-font-numeric)`, otherwise digits
change width mid scrub and the field jitters under the pointer.

## Peer colours

```ts
import { peerColor } from "@jolly-pixel/ui";

element.style.background = peerColor(peerIndex);
```

Hue rotates by the golden angle at fixed lightness and chroma, so consecutive peers land far apart
and every colour stays legible on both surfaces.
