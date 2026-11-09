// Import Third-party Dependencies
import type { ContextMenuEntry } from "@jolly-pixel/ui";

export function listLabels(
  entries: readonly ContextMenuEntry[]
): string[] {
  return entries.map((entry) => (entry === "separator" ? "-" : entry.label));
}

function branchItems(
  entries: readonly ContextMenuEntry[],
  id: string
): readonly ContextMenuEntry[] {
  const branch = entries.find((entry) => entry !== "separator" && entry.id === id);

  return branch === undefined || branch === "separator" ? [] : branch.items ?? [];
}

export function shapeItems(
  entries: readonly ContextMenuEntry[]
): readonly ContextMenuEntry[] {
  return branchItems(entries, "shape");
}

export function materialItems(
  entries: readonly ContextMenuEntry[]
): readonly ContextMenuEntry[] {
  return branchItems(entries, "material-menu");
}

export function listEnabledLabels(
  entries: readonly ContextMenuEntry[]
): string[] {
  return entries.flatMap((entry) => (
    entry === "separator" || entry.disabled === true ? [] : [entry.label]
  ));
}
