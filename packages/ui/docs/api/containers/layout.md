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

Container event types are `ContainerEventMap`, `JollyMoveDetail`,
`JollyReorderDetail`, `JollyResizeDetail`, `JollyTabChangeDetail`, and
`JollyToggleDetail`.
