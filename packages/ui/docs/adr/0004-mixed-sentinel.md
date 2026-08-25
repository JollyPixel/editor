---
status: accepted
---

# `Symbol.for` for the `Mixed` sentinel

`Mixed` marks a value that differs across a multi-selection. It is declared as
`Symbol.for("jolly-pixel.ui.mixed") as unique symbol`: the registry lookup preserves identity
across duplicate module instances, and the cast preserves the distinct type for narrowing.

## Considered Options

- **`Symbol("mixed")`.** Identity breaks silently across a duplicate module instance, and `ui` is
  resolved through `dist/` by three editors.
