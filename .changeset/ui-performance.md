---
"@jolly-pixel/ui": minor
---

Faster large trees, dock and floating drags, scrubbing, graphs, stats, facade refreshes and presence locks: fewer per-row lookups, allocations, DOM measurements and re-renders, with identical output.
`jolly-tree` re-renders only the rows whose displayed content or state changed, gains a `virtual` mode backed by `@lit-labs/virtualizer`, moves focus with arrow-key selection and sets `aria-level`/`aria-posinset`/`aria-setsize`.
`TreeSnapshot.placement(id)` returns a node's position among its siblings.
