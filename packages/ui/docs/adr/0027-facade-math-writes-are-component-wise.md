---
status: accepted
---

# The facade writes a math value component-wise, and refreshes from a snapshot

`addBinding` replaces `object[key]` for every scalar control. For a value the math dispatch matched
it copies the committed axes onto the object already there instead, so a bound `THREE.Vector3` keeps
its identity, its methods, and any other reference an application holds to it. A caller who binds
`mesh.position` gets a live `Vector3` back from the change handler, not a plain record that has
quietly replaced it.

That write leaves the property's identity unchanged, which the field's own `hasChanged` reads as no
edit at all: ADR-0021 makes vector properties immutable snapshots compared component-wise, and the
same object compares equal to itself. `Binding.refresh()` therefore assigns a fresh record built
from the value's own numeric axes rather than the bound object.

Axes the bound object does not already carry are skipped, so binding a two-axis object never grows a
`z` on it, and a `Mixed` axis is never written as a number.

`jolly-transform` is left out of the dispatch. It is not a `JollyField`: it carries no `label`,
`disabled`, `align` or `path`, and it owns three sub-fields that lock and revert independently, so
one `Binding` cannot describe it. Three bindings, or the element directly, can.

## Considered Options

- **Replacing the property, as scalars do.** Swaps a `THREE.Vector3` for a plain object on the first
  edit, breaking every method call and every other reference to it.
- **An explicit `write: "assign" | "mutate"` option.** Every 3D caller wants the same answer, and the
  wrong default silently corrupts the bound object rather than failing.
- **Assigning the bound object back to the field on refresh.** Component-wise `hasChanged` sees the
  same object and never repaints.
