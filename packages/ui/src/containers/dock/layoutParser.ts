// Import Internal Dependencies
import {
  LAYOUT_VERSION,
  type DockState,
  type FloatingState,
  type FolderState,
  type LayoutSnapshot,
  type PaneGroupState,
  type PaneState
} from "./layout.ts";

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

  if (!isRecord(parsed) || parsed.v !== LAYOUT_VERSION) {
    return null;
  }

  return {
    v: LAYOUT_VERSION,
    docks: readDocks(parsed.docks),
    floating: readFloating(parsed.floating),
    geometry: readFloating(parsed.geometry),
    panes: readPanes(parsed.panes),
    folders: readFolders(parsed.folders)
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
      groups: readGroups(state.groups)
    };
  }

  return docks;
}

function readGroups(
  value: unknown
): PaneGroupState[] {
  const groups: PaneGroupState[] = [];
  if (!Array.isArray(value)) {
    return groups;
  }

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const panes = readStringArray(entry.panes);
    if (panes.length === 0) {
      continue;
    }

    groups.push({
      panes,
      active: typeof entry.active === "string" && panes.includes(entry.active) ?
        entry.active :
        panes[0]
    });
  }

  return groups;
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
