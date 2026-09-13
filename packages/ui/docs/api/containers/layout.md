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

The same module exports `DeclaredDock`, `DeclaredLayout`, `DockState`,
`FloatingState`, `LayoutSnapshot`, and `PaneState`.

`LayoutChange` is the detail of `jolly-layout-dirty`:

```ts
type LayoutChange =
  | { type: "dock"; dock: string; size?: number; collapsed?: boolean; }
  | { type: "floating"; pane: string; geometry: FloatingState; }
  | { type: "pane"; pane: string; collapsed: boolean; }
  | { type: "folder"; pane: string; folder: string; open: boolean; };
```

Each member is also exported on its own as `DockChange`, `FloatingChange`,
`PaneChange`, and `FolderChange`. A change naming a dock or floating pane
the snapshot does not hold is ignored.

Container event types are `ContainerEventMap`, `JollyMoveDetail`,
`JollyReorderDetail`, `JollyResizeDetail`, `JollyTabChangeDetail`, and
`JollyToggleDetail`.
