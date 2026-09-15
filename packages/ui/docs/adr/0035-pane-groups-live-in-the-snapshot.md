---
status: accepted
---

# Pane groups are slots of the layout snapshot, projected as elements

A dock state is an ordered list of groups, `{ panes, active }`, and a lone pane
is a group of one. `jolly-pane-group` is a projection of a group with two or
more panes: `LayoutProjection` creates it, reuses it, and replaces it with its
last pane. The snapshot stays the only layout state
([ADR-0033](./0033-layout-snapshot-is-the-only-layout-state.md)).

Tabs that move between docks have to be panes the layout can see.
`jolly-tabs` inside an application element is invisible to it, so an editor
that wants movable tabs authors one light-DOM `jolly-pane` per tab.

## Considered Options

- **A flat pane list plus a grouping annotation.** Every transition would have
  to keep group members contiguous, and parsing would have to repair lists that
  are not.
- **Groups as authored containers only.** Dropping a pane on another pane could
  not create a group without the application reacting to the drop.
- **Letting `jolly-tabs` hold panes.** Its children are `jolly-tab` panels with
  their own selection state, which would be a second owner of the active tab.

## Consequences

- Stored layouts from before groups no longer parse their dock contents and
  fall back to the markup. There is no migration.
- A floating window still holds one pane. Dragging a tab out floats that pane.
- Tab order inside a group changes with the pointer only; the keyboard moves
  panes between slots, groups and docks.
- Visibility is derived from the snapshot, so `jolly-pane-visibility` needs no
  DOM measurement and ignores application CSS that hides a dock.
