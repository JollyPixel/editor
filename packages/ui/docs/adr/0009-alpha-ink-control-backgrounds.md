---
status: accepted
---

# Control backgrounds are alpha stops of one ink; containers paint opaque or nothing

`--jolly-control-bg` and its hover, focus and active variants are `color-mix` of a single
`--jolly-ink` at 8%, 12%, 20% and 26%, composited over whatever plane the control lands on. One
decision instead of six, and a control stays coherent at any nesting depth without each level
picking its own opaque pair. `--jolly-invalid-*` is the same mechanism with `--jolly-ink-danger`,
starting above the hover stop so an error never reads as hover.

The invariant that makes it work: **containers paint opaque or paint nothing, only leaves tint.**
Two translucent layers over each other drift lighter. Planes (`jolly-dock`, `jolly-rail`,
`jolly-dialog`, `jolly-floating`) paint a surface; in-pane containers (`jolly-folder`,
`jolly-tabs`) paint nothing; `jolly-pane` is the one hybrid, nulled out through `::slotted` when a
plane contains it.

## Consequences

Separation between containers comes from leaf tint plus `--jolly-row-gap`, not from rules. Only
dialog headers and footers keep a divider line, and that divider is deliberately faint: at 3:1 it
reads as a hard rule between every row of a sixty-control pane.
