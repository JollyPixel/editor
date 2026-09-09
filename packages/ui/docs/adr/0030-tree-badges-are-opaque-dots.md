---
status: accepted
---

# `jolly-tree` badges are opaque dots

`TreeNode.badges` is a list of `{ color, title }` the row renders as dots after the label. The tree
resolves neither, holds no idea of what a dot means, and never emits an event for one. A collaborative
outliner passes one dot per peer selecting that row, the same array shape a build status or a validation
count would use.

The field is deliberately not typed as `CollaboratorPresence`. `data/` would then import `peer/` to
render a tree row, and a tree with no collaboration would carry a presence vocabulary it never uses.

## Considered Options

- **A slot or a `::part` on the row.** Rows are virtualized by `flattenVisible` and re-rendered on every
  selection change, so a per-row slot would need one named slot per node id.
- **Rendering peers directly, from the presence port.** `jolly-tree` would read a source (ADR-0017 keeps
  `jolly-presence` free of that) and would have to know which node id maps to which domain object.
- **`jolly-presence` inside the row.** It renders a count, `(you)` and `+N more` in a row-height list; a
  20px tree row fits dots.
- **Badges as an interaction.** Nothing to select: a dot is display, and a consumer that wants a click
  target has the row itself (ADR-0029).

## Consequences

Two consumers rendering peer presence in a tree each map their own peers onto dots, and the tree cannot
deduplicate, order or cap them.
