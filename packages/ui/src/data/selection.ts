// Import Internal Dependencies
import type { FlatTreeRow } from "./treeNodes.ts";

export interface ResolveSelectionOptions<TData> {
  /** Visible rows, in document order. */
  rows: readonly FlatTreeRow<TData>[];
  clickedId: string;
  current: readonly string[];
  /**
   * Row a Shift range extends from. Presentation state the element keeps
   * locally, the same way `firstSelectedNode` is local to `arbor`'s
   * selector rather than part of the controlled `selected` value.
   */
  anchorId: string | null;
  shiftKey: boolean;
  ctrlKey: boolean;
  multiple: boolean;
}

export interface ResolvedSelection {
  selected: string[];
  anchorId: string;
}

/**
 * Ported from `arbor`'s `TreeViewSelector.updateSelection`, over row ids
 * instead of DOM elements. A plain click, or any click when `multiple` is
 * off, replaces the selection outright. Ctrl toggles membership. Shift
 * selects the contiguous sibling range between the anchor and the clicked
 * row. Both modifiers are a no-op when the anchor and the clicked row do not
 * share a parent — arbor's own restriction, since a range or a toggle across
 * two different sibling groups has no single coherent order.
 */
export function resolveSelection<TData>(
  options: ResolveSelectionOptions<TData>
): ResolvedSelection {
  const {
    rows,
    clickedId,
    current,
    anchorId,
    shiftKey,
    ctrlKey,
    multiple
  } = options;

  const clickedRow = rows.find((row) => row.node.id === clickedId);
  if (clickedRow === undefined) {
    return {
      selected: [...current],
      anchorId: anchorId ?? clickedId
    };
  }

  if (!multiple || (!shiftKey && !ctrlKey)) {
    return {
      selected: [clickedId],
      anchorId: clickedId
    };
  }

  const anchorRow = anchorId === null ?
    undefined :
    rows.find((row) => row.node.id === anchorId);

  if (
    current.length > 0 &&
    anchorRow !== undefined &&
    anchorRow.parentId !== clickedRow.parentId
  ) {
    return {
      selected: [...current],
      anchorId: anchorRow.node.id
    };
  }

  if (shiftKey && anchorRow !== undefined) {
    const siblings = rows.filter((row) => row.parentId === clickedRow.parentId);
    const anchorIndex = siblings.findIndex((row) => row.node.id === anchorRow.node.id);
    const clickedIndex = siblings.findIndex((row) => row.node.id === clickedId);
    const [from, to] = anchorIndex <= clickedIndex ?
      [anchorIndex, clickedIndex] :
      [clickedIndex, anchorIndex];

    return {
      selected: siblings.slice(from, to + 1).map((row) => row.node.id),
      anchorId: anchorRow.node.id
    };
  }

  if (ctrlKey) {
    if (current.includes(clickedId)) {
      const selected = current.filter((id) => id !== clickedId);

      return {
        selected,
        anchorId: selected[0] ?? clickedId
      };
    }

    return {
      selected: [...current, clickedId],
      anchorId: anchorId ?? clickedId
    };
  }

  return {
    selected: [clickedId],
    anchorId: clickedId
  };
}
