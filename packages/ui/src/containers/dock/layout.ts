// Import Internal Dependencies
import {
  cloneGroups,
  columnGroups,
  dockAddress,
  settleColumns,
  settleDocks,
  withoutPane
} from "./dockColumns.ts";
import { resolveOrder } from "../../storage/keys.ts";

// CONSTANTS
export const LAYOUT_VERSION = 1;

export interface PaneGroupState {
  panes: string[];
  active: string;
}

export type DockColumn = "primary" | "secondary";

export interface DockState {
  size?: number;
  collapsed?: boolean;
  groups: PaneGroupState[];
  secondary?: PaneGroupState[];
}

export interface FloatingState {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface PaneState {
  collapsed?: boolean;
}

export interface FolderState {
  open: boolean;
}

export interface LayoutSnapshot {
  v: number;
  docks: Record<string, DockState>;
  floating: Record<string, FloatingState>;
  geometry: Record<string, FloatingState>;
  panes: Record<string, PaneState>;
  folders: Record<string, Record<string, FolderState>>;
}

export interface DeclaredGroup {
  panes: string[];
  active?: string;
}

export interface DeclaredDock {
  key: string;
  size?: number;
  groups: DeclaredGroup[];
  double?: boolean;
  secondary?: DeclaredGroup[];
}

export interface DeclaredFloating {
  key: string;
  geometry: FloatingState;
}

export interface DeclaredLayout {
  docks: DeclaredDock[];
  floating: DeclaredFloating[];
  locked: string[];
}

export interface DockChange {
  type: "dock";
  dock: string;
  size?: number;
  collapsed?: boolean;
}

export interface FloatingChange {
  type: "floating";
  pane: string;
  geometry: FloatingState;
}

export interface PaneChange {
  type: "pane";
  pane: string;
  collapsed: boolean;
}

export interface FolderChange {
  type: "folder";
  pane: string;
  folder: string;
  open: boolean;
}

export interface GroupChange {
  type: "group";
  pane: string;
}

export type LayoutChange =
  | DockChange
  | FloatingChange
  | FolderChange
  | GroupChange
  | PaneChange;

export interface PanePlacement {
  dock: string;
  column: DockColumn;
  index: number;
  count: number;
  group: string[];
  active: boolean;
}

export interface DockAddress {
  dock: string;
  column: DockColumn;
}

interface DeclaredSlot extends DockAddress {
  group: DeclaredGroup;
}

interface PaneLocation {
  dock: string;
  column: DockColumn;
  slot: number;
  tab: number;
}

export function emptyLayout(): LayoutSnapshot {
  return {
    v: LAYOUT_VERSION,
    docks: {},
    floating: {},
    geometry: {},
    panes: {},
    folders: {}
  };
}

export function dockPanes(
  state: DockState
): string[] {
  return [
    ...state.groups,
    ...state.secondary ?? []
  ].flatMap((group) => group.panes);
}

export function reconcileLayout(
  stored: LayoutSnapshot | null,
  declared: DeclaredLayout
): LayoutSnapshot {
  const declaredPlacement = new Map<string, DockAddress | null>();
  const declaredOrder: string[] = [];
  const declaredGroups = new Map<string, DeclaredGroup>();
  for (const { dock, column, group } of declaredSlots(declared)) {
    for (const pane of group.panes) {
      if (!declaredPlacement.has(pane)) {
        declaredPlacement.set(pane, {
          dock,
          column
        });
        declaredOrder.push(pane);
        declaredGroups.set(pane, group);
      }
    }
  }
  const declaredGeometry = new Map<string, FloatingState>();
  for (const { key, geometry } of declared.floating) {
    declaredGeometry.set(key, geometry);
    if (!declaredPlacement.has(key)) {
      declaredPlacement.set(key, null);
      declaredOrder.push(key);
    }
  }

  const doubles = new Map(
    declared.docks.map((dock) => [dock.key, dock.double === true])
  );
  const locked = new Set(declared.locked);
  const placement = new Map<string, DockAddress | null>();
  function claim(
    pane: string,
    site: DockAddress | null
  ): void {
    if (
      declaredPlacement.has(pane) &&
      !placement.has(pane) &&
      !locked.has(pane)
    ) {
      placement.set(pane, site);
    }
  }
  if (stored !== null) {
    for (const [dockKey, state] of Object.entries(stored.docks)) {
      const double = doubles.get(dockKey);
      if (double === undefined) {
        continue;
      }

      for (const group of state.groups) {
        for (const pane of group.panes) {
          claim(pane, {
            dock: dockKey,
            column: "primary"
          });
        }
      }
      for (const group of state.secondary ?? []) {
        for (const pane of group.panes) {
          claim(pane, {
            dock: dockKey,
            column: double ? "secondary" : "primary"
          });
        }
      }
    }
    for (const pane of Object.keys(stored.floating)) {
      claim(pane, null);
    }
  }
  for (const [pane, where] of declaredPlacement) {
    if (!placement.has(pane)) {
      placement.set(pane, where);
    }
  }

  function present(
    dock: string,
    column: DockColumn
  ): string[] {
    return declaredOrder.filter((pane) => {
      const site = placement.get(pane);

      return site?.dock === dock && site.column === column;
    });
  }

  const docks: Record<string, DockState> = {};
  for (const dock of declared.docks) {
    const double = dock.double === true;
    const storedDock = stored?.docks[dock.key];
    const size = storedDock?.size ?? dock.size;
    const state: DockState = {
      ...size === undefined ? {} : { size },
      collapsed: storedDock?.collapsed === true,
      groups: arrangeGroups(
        [
          ...storedDock?.groups ?? [],
          ...double ? [] : storedDock?.secondary ?? []
        ],
        present(dock.key, "primary"),
        declaredGroups
      )
    };
    if (double) {
      state.secondary = arrangeGroups(
        storedDock?.secondary ?? [],
        present(dock.key, "secondary"),
        declaredGroups
      );
      settleColumns(state);
    }
    docks[dock.key] = state;
  }

  const geometry: Record<string, FloatingState> = {};
  for (const pane of declaredOrder) {
    const remembered = stored?.floating[pane] ??
      stored?.geometry[pane] ??
      declaredGeometry.get(pane);
    if (remembered !== undefined) {
      geometry[pane] = remembered;
    }
  }

  const floating: Record<string, FloatingState> = {};
  for (const pane of declaredOrder) {
    if (placement.get(pane) !== null) {
      continue;
    }

    floating[pane] = geometry[pane] ?? {};
  }

  const panes: Record<string, PaneState> = {};
  for (const pane of declaredOrder) {
    const collapsed = stored?.panes[pane]?.collapsed;
    if (collapsed !== undefined) {
      panes[pane] = { collapsed };
    }
  }

  return {
    v: LAYOUT_VERSION,
    docks,
    floating,
    geometry,
    panes,
    folders: stored?.folders ?? {}
  };
}

export function cloneLayout(
  snapshot: LayoutSnapshot
): LayoutSnapshot {
  return {
    v: snapshot.v,
    docks: mapRecord(snapshot.docks, (state) => {
      const copy: DockState = {
        ...state,
        groups: cloneGroups(state.groups)
      };
      if (state.secondary !== undefined) {
        copy.secondary = cloneGroups(state.secondary);
      }

      return copy;
    }),
    floating: mapRecord(snapshot.floating, (state) => {
      return { ...state };
    }),
    geometry: mapRecord(snapshot.geometry, (state) => {
      return { ...state };
    }),
    panes: mapRecord(snapshot.panes, (state) => {
      return { ...state };
    }),
    folders: mapRecord(snapshot.folders, (states) => mapRecord(
      states,
      (state) => {
        return { ...state };
      }
    ))
  };
}

export function panePlacement(
  snapshot: LayoutSnapshot,
  pane: string
): PanePlacement | null {
  const location = locatePane(snapshot, pane);
  if (location === null) {
    return null;
  }

  const groups = locationGroups(snapshot, location);
  const group = groups[location.slot];

  return {
    dock: location.dock,
    column: location.column,
    index: location.slot,
    count: groups.length,
    group: [...group.panes],
    active: group.active === pane
  };
}

export function paneVisible(
  snapshot: LayoutSnapshot,
  pane: string
): boolean {
  const folded = snapshot.panes[pane]?.collapsed === true;
  if (snapshot.floating[pane] !== undefined) {
    return !folded;
  }

  const placement = panePlacement(snapshot, pane);
  if (placement === null) {
    return false;
  }

  return snapshot.docks[placement.dock].collapsed !== true &&
    placement.active &&
    (placement.group.length > 1 || !folded);
}

export function movePane(
  snapshot: LayoutSnapshot,
  pane: string,
  to: DockAddress | string,
  index: number
): LayoutSnapshot {
  const { dock, column } = dockAddress(to);
  const target = snapshot.docks[dock];
  const targetGroups = target === undefined ?
    undefined :
    columnGroups(target, column);
  if (targetGroups === undefined) {
    return snapshot;
  }

  const from = locatePane(snapshot, pane);
  const lone = from !== null &&
    from.dock === dock &&
    from.column === column &&
    targetGroups[from.slot].panes.length === 1;
  const position = lone && index > from.slot ? index - 1 : index;
  const next = detachPane(cloneLayout(snapshot), pane);
  const state = next.docks[dock];
  state.collapsed = false;
  const groups = columnGroups(state, column)!;
  groups.splice(
    clamp(position, groups.length),
    0,
    {
      panes: [pane],
      active: pane
    }
  );
  settleDocks(next);

  return next;
}

export function stackPane(
  snapshot: LayoutSnapshot,
  pane: string,
  to: DockAddress | string,
  slot: number,
  index: number
): LayoutSnapshot {
  const { dock, column } = dockAddress(to);
  const state = snapshot.docks[dock];
  const groups = state === undefined ?
    undefined :
    columnGroups(state, column);
  const target = groups?.[slot];
  if (groups === undefined || target === undefined) {
    return snapshot;
  }

  const from = locatePane(snapshot, pane);
  const sameColumn = from !== null &&
    from.dock === dock &&
    from.column === column;
  const sameGroup = sameColumn && from.slot === slot;
  if (sameGroup && target.panes.length === 1) {
    return snapshot;
  }

  const position = sameGroup && index > from.tab ? index - 1 : index;
  const removesSlot = sameColumn &&
    !sameGroup &&
    from.slot < slot &&
    groups[from.slot].panes.length === 1;
  const next = detachPane(cloneLayout(snapshot), pane);
  const nextState = next.docks[dock];
  nextState.collapsed = false;
  const group = columnGroups(nextState, column)![
    removesSlot ? slot - 1 : slot
  ];
  group.panes.splice(
    clamp(position, group.panes.length),
    0,
    pane
  );
  group.active = pane;
  settleDocks(next);

  return next;
}

export function floatPane(
  snapshot: LayoutSnapshot,
  pane: string,
  geometry: FloatingState
): LayoutSnapshot {
  const next = detachPane(cloneLayout(snapshot), pane);
  settleDocks(next);
  next.floating[pane] = { ...geometry };
  next.geometry[pane] = { ...geometry };

  return next;
}

export function applyLayoutChange(
  snapshot: LayoutSnapshot,
  change: LayoutChange
): LayoutSnapshot {
  switch (change.type) {
    case "dock": {
      if (snapshot.docks[change.dock] === undefined) {
        return snapshot;
      }

      const next = cloneLayout(snapshot);
      const state = next.docks[change.dock];
      if (change.size !== undefined) {
        state.size = change.size;
      }
      if (change.collapsed !== undefined) {
        state.collapsed = change.collapsed;
      }

      return next;
    }
    case "floating": {
      if (snapshot.floating[change.pane] === undefined) {
        return snapshot;
      }

      const next = cloneLayout(snapshot);
      const geometry = {
        ...next.floating[change.pane],
        ...definedGeometry(change.geometry)
      };
      next.floating[change.pane] = geometry;
      next.geometry[change.pane] = { ...geometry };

      return next;
    }
    case "group": {
      const location = locatePane(snapshot, change.pane);
      if (
        location === null ||
        locationGroups(snapshot, location)[location.slot].active ===
        change.pane
      ) {
        return snapshot;
      }

      const next = cloneLayout(snapshot);
      locationGroups(next, location)[location.slot].active = change.pane;

      return next;
    }
    case "pane": {
      const next = cloneLayout(snapshot);
      next.panes[change.pane] = {
        collapsed: change.collapsed
      };

      return next;
    }
    case "folder": {
      const next = cloneLayout(snapshot);
      next.folders[change.pane] = {
        ...next.folders[change.pane],
        [change.folder]: {
          open: change.open
        }
      };

      return next;
    }
    default:
      return snapshot;
  }
}

function* declaredSlots(
  declared: DeclaredLayout
): IterableIterator<DeclaredSlot> {
  for (const dock of declared.docks) {
    for (const group of dock.groups) {
      yield {
        dock: dock.key,
        column: "primary",
        group
      };
    }
    if (dock.double !== true) {
      continue;
    }

    for (const group of dock.secondary ?? []) {
      yield {
        dock: dock.key,
        column: "secondary",
        group
      };
    }
  }
}

function arrangeGroups(
  stored: readonly PaneGroupState[],
  present: readonly string[],
  declared: ReadonlyMap<string, DeclaredGroup>
): PaneGroupState[] {
  const presentKeys = new Set(present);
  const order = resolveOrder(
    stored.flatMap((group) => group.panes),
    present
  );
  const groupOf = new Map<string, number>();
  const actives: (string | undefined)[] = [];
  for (const group of stored) {
    const id = actives.length;
    actives.push(group.active);
    for (const pane of group.panes) {
      if (presentKeys.has(pane) && !groupOf.has(pane)) {
        groupOf.set(pane, id);
      }
    }
  }

  const declaredIds = new Map<DeclaredGroup, number>();
  for (const pane of order) {
    if (groupOf.has(pane)) {
      continue;
    }

    const group = declared.get(pane);
    const sibling = group?.panes.find(
      (other) => other !== pane && groupOf.has(other)
    );
    let id: number;
    if (group !== undefined && declaredIds.has(group)) {
      id = declaredIds.get(group)!;
    }
    else if (sibling === undefined) {
      id = actives.length;
      actives.push(group?.active);
    }
    else {
      id = groupOf.get(sibling)!;
    }
    if (group !== undefined) {
      declaredIds.set(group, id);
    }
    groupOf.set(pane, id);
  }

  const built = new Map<number, PaneGroupState>();
  const groups: PaneGroupState[] = [];
  for (const pane of order) {
    const id = groupOf.get(pane)!;
    let group = built.get(id);
    if (group === undefined) {
      group = {
        panes: [],
        active: ""
      };
      built.set(id, group);
      groups.push(group);
    }
    group.panes.push(pane);
  }
  for (const [id, group] of built) {
    const wanted = actives[id];
    group.active = wanted !== undefined && group.panes.includes(wanted) ?
      wanted :
      group.panes[0];
  }

  return groups;
}

function locatePane(
  snapshot: LayoutSnapshot,
  pane: string
): PaneLocation | null {
  for (const [dock, state] of Object.entries(snapshot.docks)) {
    for (const column of ["primary", "secondary"] as const) {
      const groups = columnGroups(state, column) ?? [];
      for (let slot = 0; slot < groups.length; slot++) {
        const tab = groups[slot].panes.indexOf(pane);
        if (tab !== -1) {
          return {
            dock,
            column,
            slot,
            tab
          };
        }
      }
    }
  }

  return null;
}

function locationGroups(
  snapshot: LayoutSnapshot,
  location: PaneLocation
): PaneGroupState[] {
  return columnGroups(snapshot.docks[location.dock], location.column)!;
}

function detachPane(
  snapshot: LayoutSnapshot,
  pane: string
): LayoutSnapshot {
  for (const state of Object.values(snapshot.docks)) {
    state.groups = withoutPane(state.groups, pane);
    if (state.secondary !== undefined) {
      state.secondary = withoutPane(state.secondary, pane);
    }
  }
  delete snapshot.floating[pane];

  return snapshot;
}

function clamp(
  index: number,
  length: number
): number {
  return Math.min(Math.max(index, 0), length);
}

function definedGeometry(
  geometry: FloatingState
): FloatingState {
  const defined: FloatingState = {};
  for (const axis of ["x", "y", "width", "height"] as const) {
    const value = geometry[axis];
    if (value !== undefined) {
      defined[axis] = value;
    }
  }

  return defined;
}

function mapRecord<TValue, TResult>(
  record: Readonly<Record<string, TValue>>,
  map: (value: TValue) => TResult
): Record<string, TResult> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, map(value)])
  );
}
