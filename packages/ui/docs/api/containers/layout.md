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
of one. Stored groups win over declared ones; a pane the store never saw joins
the group of a declared sibling when one is present in the same dock.

`dockPanes(state)` flattens a dock state. `panePlacement(snapshot, pane)`
returns `{ dock, index, count, group, active }`, where `index` and `count`
count groups, or `null` for a pane that is not docked. `paneVisible(snapshot,
pane)` follows the rule described in [`jolly-dock-layout`](./dock-layout.md).

The same module exports `DeclaredDock`, `DeclaredGroup`, `DeclaredLayout`,
`DockState`, `FloatingState`, `LayoutSnapshot`, `PaneGroupState`,
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
