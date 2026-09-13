// Import Internal Dependencies
import { resolveOrder } from "../storage/keys.ts";

// CONSTANTS
const kVersion = 1;

export interface DockState {
  size?: number;
  collapsed?: boolean;
  panes: string[];
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

export interface DeclaredDock {
  key: string;
  size?: number;
  panes: string[];
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

export type LayoutChange =
  | DockChange
  | FloatingChange
  | FolderChange
  | PaneChange;

export interface PanePlacement {
  dock: string;
  index: number;
  count: number;
}

export function emptyLayout(): LayoutSnapshot {
  return {
    v: kVersion,
    docks: {},
    floating: {},
    geometry: {},
    panes: {},
    folders: {}
  };
}

export function serializeLayout(
  snapshot: LayoutSnapshot
): string {
  return JSON.stringify(snapshot);
}

export function parseLayout(
  raw: string | null
): LayoutSnapshot | null {
  if (raw === null || raw === "") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  }
  catch {
    return null;
  }

  if (!isRecord(parsed) || parsed.v !== kVersion) {
    return null;
  }

  return {
    v: kVersion,
    docks: readDocks(parsed.docks),
    floating: readFloating(parsed.floating),
    geometry: readFloating(parsed.geometry),
    panes: readPanes(parsed.panes),
    folders: readFolders(parsed.folders)
  };
}

export function reconcileLayout(
  stored: LayoutSnapshot | null,
  declared: DeclaredLayout
): LayoutSnapshot {
  const declaredPlacement = new Map<string, string | null>();
  const declaredOrder: string[] = [];
  for (const dock of declared.docks) {
    for (const pane of dock.panes) {
      if (!declaredPlacement.has(pane)) {
        declaredPlacement.set(pane, dock.key);
        declaredOrder.push(pane);
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

      for (const pane of state.panes) {
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
      panes: resolveOrder(
        storedDock?.panes ?? [],
        present
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
    v: kVersion,
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
        panes: [...state.panes]
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
  for (const [dock, state] of Object.entries(snapshot.docks)) {
    const index = state.panes.indexOf(pane);
    if (index !== -1) {
      return {
        dock,
        index,
        count: state.panes.length
      };
    }
  }

  return null;
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

  const from = target.panes.indexOf(pane);
  const position = from !== -1 && index > from ? index - 1 : index;
  const next = detachPane(cloneLayout(snapshot), pane);
  const panes = next.docks[dock].panes;
  panes.splice(
    Math.min(Math.max(position, 0), panes.length),
    0,
    pane
  );

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

function detachPane(
  snapshot: LayoutSnapshot,
  pane: string
): LayoutSnapshot {
  for (const state of Object.values(snapshot.docks)) {
    state.panes = state.panes.filter((key) => key !== pane);
  }
  delete snapshot.floating[pane];

  return snapshot;
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

function readDocks(
  value: unknown
): Record<string, DockState> {
  const docks: Record<string, DockState> = {};
  if (!isRecord(value)) {
    return docks;
  }

  for (const [key, state] of Object.entries(value)) {
    if (!isRecord(state)) {
      continue;
    }

    docks[key] = {
      ...typeof state.size === "number" && Number.isFinite(state.size) ?
        { size: state.size } :
        {},
      collapsed: state.collapsed === true,
      panes: readStringArray(state.panes)
    };
  }

  return docks;
}

function readFloating(
  value: unknown
): Record<string, FloatingState> {
  const floating: Record<string, FloatingState> = {};
  if (!isRecord(value)) {
    return floating;
  }

  for (const [key, state] of Object.entries(value)) {
    if (!isRecord(state)) {
      continue;
    }

    const geometry: FloatingState = {};
    for (const axis of ["x", "y", "width", "height"] as const) {
      const candidate = state[axis];
      if (
        typeof candidate === "number" &&
        Number.isFinite(candidate)
      ) {
        geometry[axis] = candidate;
      }
    }
    floating[key] = geometry;
  }

  return floating;
}

function readPanes(
  value: unknown
): Record<string, PaneState> {
  const panes: Record<string, PaneState> = {};
  if (!isRecord(value)) {
    return panes;
  }

  for (const [key, state] of Object.entries(value)) {
    if (
      isRecord(state) &&
      typeof state.collapsed === "boolean"
    ) {
      panes[key] = {
        collapsed: state.collapsed
      };
    }
  }

  return panes;
}

function readFolders(
  value: unknown
): Record<string, Record<string, FolderState>> {
  const folders: Record<string, Record<string, FolderState>> = {};
  if (!isRecord(value)) {
    return folders;
  }

  for (const [paneKey, states] of Object.entries(value)) {
    if (!isRecord(states)) {
      continue;
    }

    const paneFolders: Record<string, FolderState> = {};
    for (const [folderKey, state] of Object.entries(states)) {
      if (
        isRecord(state) &&
        typeof state.open === "boolean"
      ) {
        paneFolders[folderKey] = {
          open: state.open
        };
      }
    }
    folders[paneKey] = paneFolders;
  }

  return folders;
}

function readStringArray(
  value: unknown
): string[] {
  return Array.isArray(value) ?
    value.filter((entry): entry is string => typeof entry === "string") :
    [];
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value);
}
