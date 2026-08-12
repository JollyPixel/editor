// Import Internal Dependencies
import { resolveOrder } from "../storage/keys.ts";

// CONSTANTS
const kVersion = 1;

export interface DockState {
  size?: number;
  collapsed?: boolean;
  panes: string[];
}

/**
 * Floating geometry. An empty object means the pane floats at whatever
 * geometry its element declares.
 */
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
  /**
   * Geometry every pane last floated at, whether or not it floats now.
   *
   * `floating` says where a pane is; this says what size it comes back at. A
   * pane docked out of a window loses the window, and with it the only record
   * of how big it was, so a pane dragged back out returned at whatever size
   * its dock had stretched it to. Keeping the two apart is what lets a pane be
   * docked and still remember.
   */
  geometry: Record<string, FloatingState>;
  panes: Record<string, PaneState>;
  folders: Record<string, Record<string, FolderState>>;
}

export interface DeclaredDock {
  key: string;
  /** Authored size, restored when no stored one applies. */
  size?: number;
  panes: string[];
}

export interface DeclaredFloating {
  key: string;
  /** Authored geometry, restored when no stored one applies. */
  geometry: FloatingState;
}

/**
 * What the author's markup asks for, in document order.
 */
export interface DeclaredLayout {
  docks: DeclaredDock[];
  floating: DeclaredFloating[];
  /**
   * Panes pinned by their author. Stored placement never moves these, so a
   * snapshot written before one was pinned cannot strand it somewhere it has
   * no way back from.
   */
  locked: string[];
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

/**
 * Reads a stored snapshot, returning `null` for absent, malformed, or
 * foreign-version payloads so the caller falls back to the markup.
 */
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

/**
 * Merges the stored arrangement onto the declared one.
 *
 * Stored placement wins for every pane the markup still declares, bar the
 * locked ones, which stay where they were authored. Panes the store does not
 * know about land where they were declared, anchored to their declared
 * neighbours. Docks and panes that vanished from the markup are dropped, so
 * the snapshot never grows stale entries.
 *
 * Geometry follows the same rule, and is carried for every declared pane
 * rather than only the floating ones, so a pane sitting in a dock still knows
 * the size it would come back out at. Passing no stored snapshot therefore
 * yields the authored arrangement whole, sizes and window positions included,
 * and forgets any size a pane was given since, which is what a reset asks for.
 */
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

  // A pane only appears under "floating" while it is in a window, and a
  // window on screen outranks a memory of one, so that record is read first.
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
