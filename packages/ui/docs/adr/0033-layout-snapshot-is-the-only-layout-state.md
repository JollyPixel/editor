---
status: accepted
---

# The layout snapshot is the only layout state, groups and columns included

`jolly-dock-layout` keeps pane placement, dock size and collapse, floating geometry, pane folds and
folder state in one `LayoutSnapshot`. A drag or keyboard move computes the next snapshot with a pure
function in `layout.ts`, then `LayoutProjection` writes it onto the DOM. Nothing reads the DOM back
to learn what changed. Docks, windows and panes report their own edits as a typed `LayoutChange`.

Keys and reconciliation are unchanged, so [ADR-0022](./0022-persistence-keys-and-reconciliation.md)
still holds.

A dock state is an ordered list of groups, `{ panes, active }`, and a lone pane is a group of one.
`jolly-pane-group` is a projection of a group with two or more panes: `LayoutProjection` creates it,
reuses it, and replaces it with its last pane. Tabs that move between docks have to be panes the
layout can see, so an editor that wants movable tabs authors one light-DOM `jolly-pane` per tab
rather than a `jolly-tabs`.

A `double` dock keeps its second column in the same `DockState`, as `secondary` next to `groups`, and
the projection moves a slot there with `slot="secondary"`. Size, collapse and visibility stay on the
dock, so both columns resize, collapse and hide together. Transitions address a column with
`{ dock, column }`; a plain dock key means the primary column. A dock whose primary column empties
takes the secondary groups, so no empty strip stays against the screen edge.

## Considered Options

- **Reading the DOM after each mutation.** The previous design. Every layout property needed a write
  mapping, a read mapping and a side cache, and a slot change could reconcile a stale snapshot over a
  move that had just been made.
- **Children writing straight to storage.** Two owners for one persisted document.
- **A flat pane list plus a grouping annotation.** Every transition would have to keep group members
  contiguous, and parsing would have to repair lists that are not.
- **Groups as authored containers only.** Dropping a pane on another pane could not create a group
  without the application reacting to the drop.
- **Letting `jolly-tabs` hold panes.** Its `jolly-tab` panels have their own selection state, a
  second owner of the active tab.
- **Two authored docks side by side for a double dock.** Each has its own handle, size and collapse
  state, and nothing keeps the widths equal.

## Consequences

A property set on a dock or window from outside, without an interaction that reports it, is not in
the snapshot until the next `sync()`. Clamping a window to the viewport is a display concern and is
not recorded.

Visibility is derived from the snapshot, so `jolly-pane-visibility` needs no DOM measurement and
ignores application CSS that hides a dock.

A floating window holds one pane; dragging a tab out floats that pane. Consumers comparing
`PanePlacement` values must compare `column` too. The second column has no splitter, and the columns
are always equal.
