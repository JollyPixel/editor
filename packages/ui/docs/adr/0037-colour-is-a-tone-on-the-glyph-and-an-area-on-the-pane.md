---
status: accepted
---

# Colour is a tone on the glyph and an area on the pane, and a dialog's intent is not a tone

A glyph is registered with an optional tone, one of seven hues
(`registerIcon(name, glyph, { tone })`). Two classes inside the glyph opt
shapes into it: `tone-fill` paints a closed shape under the outline, `tone-ink`
shifts a `currentColor` stroke or fill. How much tone shows is one inherited
percentage, `--jolly-icon-tone-strength`: hosts leave it at the rest stop and
raise it to the engaged stop on hover and selection.

A glyph can instead be an illustration with literal colours, registered on its
own grid (`registerIcon(name, glyph, { viewBox })`) and without a tone. It is
allowed anywhere a glyph is: the colours carry identity, such as an asset kind
told apart at a glance in a tree, and an outline drawn into the glyph keeps it
readable on light and dark grounds. It behaves like an image: tones, `on-fill`
and the tone strength do not reach it, and forced colours leave it as drawn.

A pane whose icon has a tone, or that sets `tone`, is a toned area. It sets
`--jolly-area-tone` and `--jolly-area-fill` on itself and redeclares the accent
tokens from them, so its header, its group's tab bar, its folders, separators
and accent-filled controls take the hue. Scope hosts read
`--jolly-area-fill` and `--jolly-area-tone` as the first choice for
`--jolly-accent-fill`, `--jolly-accent-text` and `--jolly-focus-ring`, so a
component that declares tokens of its own inside a toned pane follows the area
too.

`jolly-dialog` is a toned area the same way. Its `intent` (`info`, `success`,
`warning`, `danger`) is a separate input: it sets `--jolly-dialog-header-bg`
from an `--jolly-intent-*-fill` token and nothing else, wins over a tone, and
drops the area. The seven hues stay clear of the semantic ones — `coral` sits
at 42 degrees so a toned header never reads as an error — and an intent states
what the dialog means while its actions keep their own meaning.

## Considered Options

- **A `tone` attribute at every call site.** Pane tabs, tool buttons, tree rows
  and option lists all take an icon name; each would need tone plumbing. The
  registration already names the glyph once, so the tone lives there, and a
  replaced glyph replaces its tone.
- **Multicolour glyphs as the only colour model.** They cannot follow
  `light-dark()`, a fill behind them, or forced colours, so line glyphs keep
  tones and illustrations are the exception a glyph opts into.
- **Mapping an illustration's colours to tones.** Seven hues cannot carry the
  shading of a drawn object, and the result would no longer match its source.
- **Overriding the accent tokens from the pane only.** A nested scope host
  redeclares every token on itself and shadowed the override; the embedded
  texture editor stayed blue inside a pink pane.
- **Warning and danger as tones.** Undoes the separation between decorative
  and semantic hues.
- **An intent that retints the dialog content.** An amber accent button stops
  reading as the primary action, and a destructive action already has the
  `danger` button variant.
- **Keeping both the area tone and the intent header.** A red header over teal
  focus rings and accent buttons carries two signals at once.

## Consequences

- Tones are off (strength `0%`) wherever a fill already carries meaning:
  `accent` and `danger` buttons, a checked segment, a selected pane tab, a
  dialog header icon, and under forced colours.
- An icon over an accent fill needs the lighter stop, which a local
  `color-scheme` flip cannot give because tone tokens resolve on the scope
  host. `jolly-icon` takes `on-fill` instead, and folder actions, whose ground
  is inverted, swap the stops.
- `tone-fill` hides detail drawn inside the shape and reads muddy under heavy
  strokes. Glyphs with inner detail, one continuous stroke, or strokes past
  about 2px (`editor.pixel-art` uses 2.4px) tone with `tone-ink` only.
- An illustrated glyph keeps its colours on an accent fill and under forced
  colours. Its outline is what separates it from the ground, so an
  illustration without one is not a fit for a toolbar or a selected row.
- Illustrations lose detail below 16px; `jolly-tree` exposes
  `--jolly-tree-icon-size` for rows that show them.
- `lock` and `revert` stay untoned: their colour already means who holds the
  lock and that the value is modified.
- `warning` and `danger` intents switch the dialog to `role="alertdialog"`, and
  every intent has a default icon, so the intent never rests on colour alone.
- `showConfirm({ danger: true })` defaults to the `danger` intent, so existing
  destructive confirms changed appearance without a call-site edit.
