# Layout data and functions

The container layout exports serialize persisted dock and floating-window
state.

```ts
import {
  emptyLayout,
  parseLayout,
  reconcileLayout,
  serializeLayout
} from "@jolly-pixel/ui";
```

`emptyLayout()` creates an empty `LayoutSnapshot`. `parseLayout()` returns a
supported snapshot or `null` for absent, malformed, or unsupported data.
`reconcileLayout()` combines a stored snapshot with the currently declared
docks and panes. `serializeLayout()` produces the persisted JSON string.

A dock state holds `groups`, each `{ panes, active }`. A lone pane is a group
of one. A `double` dock also holds `secondary`, the groups of its second
column, which is empty while the column is closed. Stored `secondary` groups
return to `groups` when the dock is no longer declared `double`, and a
dock whose `groups` are empty takes its `secondary` groups instead. Stored groups win over declared ones; a pane the store never saw joins
the group of a declared sibling when one is present in the same dock.

`dockPanes(state)` flattens a dock state, primary column first.
`panePlacement(snapshot, pane)` returns
`{ dock, column, index, count, group, active }`, where `index` and `count`
count the groups of that column, or `null` for a pane that is not docked.
`column` is `"primary"` or `"secondary"`.

`movePane(snapshot, pane, to, index)` and
`stackPane(snapshot, pane, to, slot, index)` take a dock key, which targets
the primary column, or a `DockAddress` `{ dock, column }`. A move to the
second column of a dock that is not `double` returns the snapshot unchanged.
`dockAddress(to)` normalizes either form, and
`columnGroups(state, column)` returns the groups of one column, or
`undefined` for a second column the dock does not have. `paneVisible(snapshot,
pane)` follows the rule described in [`jolly-dock-layout`](./dock-layout.md).

The same module exports `DeclaredDock`, `DeclaredGroup`, `DeclaredLayout`,
`DockAddress`, `DockColumn`, `DockState`, `FloatingState`, `LayoutSnapshot`, `PaneGroupState`,
`PanePlacement`, and `PaneState`.

`LayoutChange` is the detail of `jolly-layout-dirty`:

```ts
type LayoutChange =
  | { type: "dock"; dock: string; size?: number; collapsed?: boolean; }
  | { type: "floating"; pane: string; geometry: FloatingState; }
  | { type: "group"; pane: string; }
  | { type: "pane"; pane: string; collapsed: boolean; }
  | { type: "folder"; pane: string; folder: string; open: boolean; };
```

Each member is also exported on its own as `DockChange`, `FloatingChange`,
`GroupChange`, `PaneChange`, and `FolderChange`. A `GroupChange` activates
the named pane inside its group. A change naming a dock or floating pane
the snapshot does not hold is ignored.

Container event types are `ContainerEventMap`, `JollyMoveDetail`,
`JollyReorderDetail`, `JollyResizeDetail`, `JollyTabChangeDetail`,
`JollyToggleDetail`, and `PaneVisibilityDetail`.
