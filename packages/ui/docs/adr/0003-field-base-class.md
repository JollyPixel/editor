---
status: accepted
---

# One shared field contract on a base class, not a mixin or controller

Every value-bearing control extends `JollyField`, which owns `label`, `value`, `default`,
`lockedBy`, `peers`, `path`, `disabled`, `readonly`, `error`, `align` and `labelPosition` — plus the
chrome rendered around the value. The four state-bearing members are in from the start because they
change what a value means, and retrofitting them touches every render path.

`Mixed` marks a value that differs across a multi-selection. It is declared as
`Symbol.for("jolly-pixel.ui.mixed") as unique symbol`: the registry lookup preserves identity
across duplicate module instances, and the cast preserves the distinct type for narrowing.

## Considered Options

- **A reactive controller.** A controller cannot render the chrome around the value, so wiring
  `lockedBy` would edit twelve files instead of one.
- **A generic mixin.** Loses `T`, which then has to be redeclared per control.
- **`jolly-property-row` owning label, gutter and chips.** Every field would need a wrapper.
- **`Symbol("mixed")` for the sentinel.** Identity breaks silently across a duplicate module
  instance, and `ui` is resolved through `dist/` by three editors.

## Consequences

`JollyField` stays out of the public barrel. Exporting it publishes a subclassable base, its
protected surface and its DOM shape as versioned API before any consumer subclasses it; promoting
it later is additive.
