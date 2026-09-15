// Import Internal Dependencies
import { resolveOrder } from "../../storage/keys.ts";

// CONSTANTS
export const LAYOUT_VERSION = 1;

export interface PaneGroupState {
  panes: string[];
  active: string;
}

export interface DockState {
  size?: number;
  collapsed?: boolean;
  groups: PaneGroupState[];
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
  index: number;
  count: number;
  group: string[];
  active: boolean;
}

interface PaneLocation {
  dock: string;
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
  return state.groups.flatMap((group) => group.panes);
}

export function reconcileLayout(
  stored: LayoutSnapshot | null,
  declared: DeclaredLayout
): LayoutSnapshot {
  const declaredPlacement = new Map<string, string | null>();
  const declaredOrder: string[] = [];
  const declaredGroups = new Map<string, DeclaredGroup>();
  for (const dock of declared.docks) {
    for (const group of dock.groups) {
      for (const pane of group.panes) {
        if (!declaredPlacement.has(pane)) {
          declaredPlacement.set(pane, dock.key);
          declaredOrder.push(pane);
          declaredGroups.set(pane, group);
        }
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

  const dockKeys = new Set(
    declared.docks.map((dock) => dock.key)
  );
  const locked = new Set(declared.locked);
  const placement = new Map<string, string | null>();
  if (stored !== null) {
    for (const [dockKey, state] of Object.entries(stored.docks)) {
      if (!dockKeys.has(dockKey)) {
        continue;
      }

      for (const pane of dockPanes(state)) {
        if (
          declaredPlacement.has(pane) &&
          !placement.has(pane) &&
          !locked.has(pane)
        ) {
          placement.set(pane, dockKey);
        }
      }
    }
    for (const pane of Object.keys(stored.floating)) {
      if (
        declaredPlacement.has(pane) &&
        !placement.has(pane) &&
        !locked.has(pane)
      ) {
        placement.set(pane, null);
      }
    }
  }
  for (const [pane, where] of declaredPlacement) {
    if (!placement.has(pane)) {
      placement.set(pane, where);
    }
  }

  const docks: Record<string, DockState> = {};
  for (const dock of declared.docks) {
    const present = declaredOrder.filter(
      (pane) => placement.get(pane) === dock.key
    );
    const storedDock = stored?.docks[dock.key];
    const size = storedDock?.size ?? dock.size;
    docks[dock.key] = {
      ...size === undefined ? {} : { size },
      collapsed: storedDock?.collapsed === true,
      groups: arrangeGroups(
        storedDock?.groups ?? [],
        present,
        declaredGroups
      )
    };
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
      return {
        ...state,
        groups: state.groups.map((group) => {
          return {
            panes: [...group.panes],
            active: group.active
          };
        })
      };
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

  const { groups } = snapshot.docks[location.dock];
  const group = groups[location.slot];

  return {
    dock: location.dock,
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
  dock: string,
  index: number
): LayoutSnapshot {
  const target = snapshot.docks[dock];
  if (target === undefined) {
    return snapshot;
  }

  const from = locatePane(snapshot, pane);
  const lone = from !== null &&
    from.dock === dock &&
    target.groups[from.slot].panes.length === 1;
  const position = lone && index > from.slot ? index - 1 : index;
  const next = detachPane(cloneLayout(snapshot), pane);
  next.docks[dock].collapsed = false;
  const { groups } = next.docks[dock];
  groups.splice(
    clamp(position, groups.length),
    0,
    {
      panes: [pane],
      active: pane
    }
  );

  return next;
}

export function stackPane(
  snapshot: LayoutSnapshot,
  pane: string,
  dock: string,
  slot: number,
  index: number
): LayoutSnapshot {
  const groups = snapshot.docks[dock]?.groups;
  const target = groups?.[slot];
  if (groups === undefined || target === undefined) {
    return snapshot;
  }

  const from = locatePane(snapshot, pane);
  const sameDock = from !== null && from.dock === dock;
  const sameGroup = sameDock && from.slot === slot;
  if (sameGroup && target.panes.length === 1) {
    return snapshot;
  }

  const position = sameGroup && index > from.tab ? index - 1 : index;
  const removesSlot = sameDock &&
    !sameGroup &&
    from.slot < slot &&
    groups[from.slot].panes.length === 1;
  const next = detachPane(cloneLayout(snapshot), pane);
  next.docks[dock].collapsed = false;
  const group = next.docks[dock].groups[removesSlot ? slot - 1 : slot];
  group.panes.splice(
    clamp(position, group.panes.length),
    0,
    pane
  );
  group.active = pane;

  return next;
}

export function floatPane(
  snapshot: LayoutSnapshot,
  pane: string,
  geometry: FloatingState
): LayoutSnapshot {
  const next = detachPane(cloneLayout(snapshot), pane);
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
        snapshot.docks[location.dock].groups[location.slot].active ===
        change.pane
      ) {
        return snapshot;
      }

      const next = cloneLayout(snapshot);
      next.docks[location.dock].groups[location.slot].active = change.pane;

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
    for (let slot = 0; slot < state.groups.length; slot++) {
      const tab = state.groups[slot].panes.indexOf(pane);
      if (tab !== -1) {
        return {
          dock,
          slot,
          tab
        };
      }
    }
  }

  return null;
}

function detachPane(
  snapshot: LayoutSnapshot,
  pane: string
): LayoutSnapshot {
  for (const state of Object.values(snapshot.docks)) {
    const groups: PaneGroupState[] = [];
    for (const group of state.groups) {
      const tab = group.panes.indexOf(pane);
      if (tab === -1) {
        groups.push(group);
        continue;
      }

      const panes = group.panes.filter((key) => key !== pane);
      if (panes.length === 0) {
        continue;
      }

      groups.push({
        panes,
        active: group.active === pane ?
          panes[Math.min(tab, panes.length - 1)] :
          group.active
      });
    }
    state.groups = groups;
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
