// Import Internal Dependencies
import type {
  DockAddress,
  DockColumn,
  DockState,
  LayoutSnapshot,
  PaneGroupState
} from "./layout.ts";

export function columnGroups(
  state: DockState,
  column: DockColumn
): PaneGroupState[] | undefined {
  return column === "primary" ? state.groups : state.secondary;
}

export function dockAddress(
  target: DockAddress | string
): DockAddress {
  return typeof target === "string" ?
    {
      dock: target,
      column: "primary"
    } :
    target;
}

export function withoutPane(
  groups: readonly PaneGroupState[],
  pane: string
): PaneGroupState[] {
  const kept: PaneGroupState[] = [];
  for (const group of groups) {
    const tab = group.panes.indexOf(pane);
    if (tab === -1) {
      kept.push(group);
      continue;
    }

    const panes = group.panes.filter((key) => key !== pane);
    if (panes.length === 0) {
      continue;
    }

    kept.push({
      panes,
      active: group.active === pane ?
        panes[Math.min(tab, panes.length - 1)] :
        group.active
    });
  }

  return kept;
}

export function settleColumns(
  state: DockState
): void {
  if (
    state.secondary !== undefined &&
    state.groups.length === 0 &&
    state.secondary.length > 0
  ) {
    state.groups = state.secondary;
    state.secondary = [];
  }
}

export function settleDocks(
  snapshot: LayoutSnapshot
): void {
  for (const state of Object.values(snapshot.docks)) {
    settleColumns(state);
  }
}

export function cloneGroups(
  groups: readonly PaneGroupState[]
): PaneGroupState[] {
  return groups.map((group) => {
    return {
      panes: [...group.panes],
      active: group.active
    };
  });
}
