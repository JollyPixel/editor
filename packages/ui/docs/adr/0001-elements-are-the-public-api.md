---
status: accepted
---

# Custom elements are the public API, the facade only constructs them

Editors write Lit templates and examples want Tweakpane ergonomics, so the package ships both:
custom elements are the implementation and the public surface, and a builder facade (`Pane`,
`addFolder`, `addBinding`) constructs those same elements with no rendering of its own.

## Considered Options

- **An imperative builder only, a Tweakpane clone.** Editors would rewrite working Lit templates
  as builder calls.
- **Elements only, no facade.** Examples would keep Tweakpane, and the deduplication goal fails.
