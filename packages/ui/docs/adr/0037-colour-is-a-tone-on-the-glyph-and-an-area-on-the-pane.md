---
status: accepted
---

# Colour is a tone on the glyph and an area on the pane

A glyph is registered with an optional tone, one of seven hues
(`registerIcon(name, glyph, { tone })`). Two classes inside the glyph opt
shapes into it: `tone-fill` paints a closed shape under the outline, `tone-ink`
shifts a `currentColor` stroke or fill. How much tone shows is one inherited
percentage, `--jolly-icon-tone-strength`: hosts leave it at the rest stop and
raise it to the engaged stop on hover and selection.

A pane whose icon has a tone, or that sets `tone`, is a toned area. It sets
`--jolly-area-tone` and `--jolly-area-fill` on itself and redeclares the accent
tokens from them, so its header, its group's tab bar, its folders, separators
and accent-filled controls take the hue. Scope hosts read
`--jolly-area-fill` and `--jolly-area-tone` as the first choice for
`--jolly-accent-fill`, `--jolly-accent-text` and `--jolly-focus-ring`, so a
component that declares tokens of its own inside a toned pane follows the area
too.

## Considered Options

- **A `tone` attribute at every call site.** Pane tabs, tool buttons, tree rows
  and option lists all take an icon name; each would need tone plumbing. The
  registration already names the glyph once, so the tone lives there, and a
  replaced glyph replaces its tone.
- **Multicolour glyphs with literal colours.** They cannot follow
  `light-dark()`, a fill behind them, or forced colours.
- **Overriding the accent tokens from the pane only.** A nested scope host
  redeclares every token on itself and shadowed the override; the embedded
  texture editor stayed blue inside a pink pane.

## Consequences

- Tones are off (strength `0%`) wherever a fill already carries meaning:
  `accent` and `danger` buttons, a checked segment, a selected pane tab, and
  under forced colours.
- An icon over an accent fill needs the lighter stop, which a local
  `color-scheme` flip cannot give because tone tokens resolve on the scope
  host. `jolly-icon` takes `on-fill` instead, and folder actions, whose ground
  is inverted, swap the stops.
- `tone-fill` hides detail drawn inside the shape. Glyphs with inner detail, or
  made of one continuous stroke, use `tone-ink` on the whole stroke; tinting
  part of a stroke reads as a rendering fault.
- `tone-fill` suits thin outlines (1.5 to 2px). Under a heavy stroke on a dark
  ground the rest-strength fill reads muddy, so `editor.pixel-art`, whose glyphs
  use 2.4px strokes, tones with `tone-ink` only.
- `coral` sits at 42 degrees, away from the danger hue, so a toned header never
  reads as an error.
- `lock` and `revert` stay untoned: their colour already means who holds the
  lock and that the value is modified.
