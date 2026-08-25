---
status: accepted
---

# Non-text contrast is deliberately not met for control boundaries

Controls carry no border. A control is separated from its surface by an 8% ink fill, roughly 1.1:1,
and hover, focus and active are further alpha stops on that same fill, so WCAG 1.4.11 is not met.
This is a chosen trade: the borderless, fill-differentiated look is the design goal, and a boundary
clearing 3:1 by fill alone forces surfaces heavy enough to lose it. Text contrast targets are met —
4.5:1 for body and label text, 3:1 at 18px and for peer colours against both surfaces.

There is no focus ring. Eight states can be active at once, so each owns a different channel: a fill
step for focus, hover and active, a leading bar for locked and modified, re-tinted ink for error, a
dash for mixed, trailing chips for peers.

## Considered Options

- **A single ring chosen by precedence.** Focus disappears exactly when a field is locked or
  invalid, failing WCAG 2.4.7.
- **Trailing badges for every state.** Three badges plus gaps consume about 48px of value width at
  `compact` density.
- **An inset ring inside the control for the lock.** Doubles with the border an input already has,
  floats detached on a borderless range, and boxes a whole group of checkboxes.
- **Elevation-led surfaces.** Blurred shadows on 20px rows read as blur and cost paint across sixty
  controls.

## Consequences

An audit of any editor built on this package will flag control boundaries and keyboard focus. Two
mitigations keep the result operable: `@media (forced-colors: active)` drops the ink system for
system colours, and focus is layered rather than single-channel — the control fill steps to 20% and
the containing row tints at 5%, so the active row is locatable in a long pane.

Contrast is a design constraint checked when ramps are authored, not a unit test. `light-dark()` and
the ramp `var()` chain resolve only in a browser, and duplicating the palette as TypeScript data
solely so a test can assert it is not warranted.
