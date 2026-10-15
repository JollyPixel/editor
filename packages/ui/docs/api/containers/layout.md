# Layout data and functions

The snapshot a [`jolly-dock-layout`](./dock-layout.md) persists, and the
functions that read it.

```ts
import {
  emptyLayout,
  parseLayout,
  reconcileLayout,
  serializeLayout
} from "@jolly-pixel/ui";
```

## `LayoutSnapshot`

```ts
interface LayoutSnapshot {
  v: number;
  docks: Record<string, DockState>;
  floating: Record<string, FloatingState>;
  geometry: Record<string, FloatingState>;
  panes: Record<string, PaneState>;
  folders: Record<string, Record<string, { open: boolean; }>>;
}

interface DockState {
  size?: number;
  collapsed?: boolean;
  groups: PaneGroupState[];
  // Groups of the second column, empty while it is closed.
  secondary?: PaneGroupState[];
}

interface PaneGroupState {
  panes: string[];
  active: string;
}

interface FloatingState {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface PaneState {
  collapsed?: boolean;
}
```

- A lone pane is a group of one.
- Keys are dock and pane `key` values.

## Functions

### `emptyLayout(): LayoutSnapshot`

A snapshot with no dock, window or pane.

### `parseLayout(raw: string | null): LayoutSnapshot | null`

`null` for absent, malformed or unsupported data.

### `serializeLayout(snapshot: LayoutSnapshot): string`

The JSON string the layout stores.

### `reconcileLayout(stored: LayoutSnapshot | null, declared: DeclaredLayout): LayoutSnapshot`

Combines a stored snapshot with the docks and panes currently declared.

- Stored groups win over declared ones.
- A pane the store never saw joins the group of a declared sibling in the same
  dock, when there is one.
- Stored `secondary` groups return to `groups` when the dock is no longer
  `double`.
- A dock with empty `groups` takes its `secondary` groups.

```ts
interface DeclaredLayout {
  docks: DeclaredDock[];
  floating: { key: string; geometry: FloatingState; }[];
  locked: string[];
}

interface DeclaredDock {
  key: string;
  size?: number;
  groups: DeclaredGroup[];
  double?: boolean;
  secondary?: DeclaredGroup[];
}

interface DeclaredGroup {
  panes: string[];
  active?: string;
}
```

### `dockPanes(state: DockState): string[]`

Every pane of a dock, primary column first.

### `panePlacement(snapshot: LayoutSnapshot, pane: string): PanePlacement | null`

`null` for a pane that is not docked.

```ts
interface PanePlacement {
  dock: string;
  column: "primary" | "secondary";
  // Position among the groups of that column.
  index: number;
  count: number;
  group: string[];
  active: boolean;
}
```

### `paneVisible(snapshot: LayoutSnapshot, pane: string): boolean`

The visibility rule of [`jolly-pane-visibility`](./dock-layout.md#events).

### `dockAddress(to: DockAddress | string): DockAddress`

Normalizes a dock key, which means its primary column, into a `DockAddress`.

```ts
interface DockAddress {
  dock: string;
  column: "primary" | "secondary";
}
```

### `columnGroups(state: DockState, column: DockColumn): PaneGroupState[] | undefined`

The groups of one column, `undefined` for a second column the dock does not
have.

## `LayoutChange`

The detail of `jolly-layout-dirty`, which docks, floating windows and panes
emit when they change on their own.

```ts
type LayoutChange =
  | { type: "dock"; dock: string; size?: number; collapsed?: boolean; }
  | { type: "floating"; pane: string; geometry: FloatingState; }
  | { type: "group"; pane: string; }
  | { type: "pane"; pane: string; collapsed: boolean; }
  | { type: "folder"; pane: string; folder: string; open: boolean; };
```

- Each member is exported on its own: `DockChange`, `FloatingChange`,
  `GroupChange`, `PaneChange`, `FolderChange`.
- A `GroupChange` activates the named pane in its group.
- A change naming a dock or floating pane the snapshot does not hold is
  ignored.

## Event detail types

`ContainerEventMap`, `JollyContextActionDetail`, `JollyHeadingChangeDetail`,
`JollyMoveDetail`, `JollyReorderDetail`, `JollySearchDetail`,
`JollyResizeDetail`, `JollyTabChangeDetail`, `JollyTabReorderDetail`,
`JollyToggleDetail` and `PaneVisibilityDetail` are exported from the root
entry point.
