// Import Internal Dependencies
import type { TreeDropWhere } from "./contract.ts";
import type { FlatTreeRow } from "./model.ts";

export interface TreeDropTarget {
  targetId: string;
  where: TreeDropWhere;
}

export type TreeInteraction =
  | {
    kind: "idle";
    suppressClick: boolean;
  }
  | {
    kind: "renaming";
    id: string;
  }
  | {
    kind: "pointer-move";
    movedIds: string[];
    preview: TreeDropTarget | null;
  }
  | {
    kind: "keyboard-move";
    movedIds: string[];
    cursorId: string;
    where: TreeDropWhere;
  };

export type TreeKeyAction =
  | {
    kind: "select";
    id: string;
  }
  | {
    kind: "toggle-expand";
    id: string;
    expanded: boolean;
  }
  | {
    kind: "activate";
    id: string;
  }
  | {
    kind: "rename";
    id: string;
  }
  | {
    kind: "interaction";
    interaction: TreeInteraction;
  }
  | {
    kind: "commit-move";
  };

export interface ResolveTreeKeyOptions<TData> {
  key: string;
  rows: readonly FlatTreeRow<TData>[];
  activeId: string;
  interaction: TreeInteraction;
  selected: readonly string[];
  expanded: ReadonlySet<string>;
  reorderable: boolean;
  renamableIds: ReadonlySet<string>;
}

export function idleTreeInteraction(
  suppressClick = false
): TreeInteraction {
  return {
    kind: "idle",
    suppressClick
  };
}

export function beginKeyboardMove<TData>(
  rows: readonly FlatTreeRow<TData>[],
  selected: readonly string[],
  activeId: string
): TreeInteraction {
  const movedIds = selected.includes(activeId)
    ? [...selected]
    : [activeId];
  const cursor = rows.find(
    (row) => !movedIds.includes(row.node.id)
  );
  if (cursor === undefined) {
    return idleTreeInteraction();
  }

  return {
    kind: "keyboard-move",
    movedIds,
    cursorId: cursor.node.id,
    where: "below"
  };
}

export function moveKeyboardCursor<TData>(
  interaction: TreeInteraction,
  rows: readonly FlatTreeRow<TData>[],
  delta: -1 | 1
): TreeInteraction {
  if (interaction.kind !== "keyboard-move") {
    return interaction;
  }

  const cursorIndex = rows.findIndex(
    (row) => row.node.id === interaction.cursorId
  );
  let index = cursorIndex + delta;
  while (index >= 0 && index < rows.length) {
    const row = rows[index];
    if (!interaction.movedIds.includes(row.node.id)) {
      return {
        ...interaction,
        cursorId: row.node.id
      };
    }
    index += delta;
  }

  return interaction;
}

export function cycleKeyboardDropWhere(
  interaction: TreeInteraction,
  delta: -1 | 1
): TreeInteraction {
  if (interaction.kind !== "keyboard-move") {
    return interaction;
  }

  const order: TreeDropWhere[] = [
    "above",
    "inside",
    "below"
  ];
  const position = order.indexOf(interaction.where);
  const nextPosition = (
    position + delta + order.length
  ) % order.length;

  return {
    ...interaction,
    where: order[nextPosition]
  };
}

export function resolveTreeKey<TData>(
  options: ResolveTreeKeyOptions<TData>
): TreeKeyAction | null {
  const {
    key,
    rows,
    activeId,
    interaction,
    selected,
    expanded,
    reorderable,
    renamableIds
  } = options;
  if (interaction.kind === "keyboard-move") {
    return resolveMoveKey(key, interaction, rows);
  }

  const activeIndex = rows.findIndex((row) => row.node.id === activeId);
  const activeRow = rows[activeIndex];
  if (activeRow === undefined) {
    return null;
  }

  if (key === "ArrowDown" || key === "ArrowUp") {
    const delta = key === "ArrowDown" ? 1 : -1;
    const index = Math.min(
      Math.max(activeIndex + delta, 0),
      rows.length - 1
    );

    return {
      kind: "select",
      id: rows[index].node.id
    };
  }
  if (key === "ArrowRight" && activeRow.node.children !== undefined) {
    if (!expanded.has(activeId)) {
      return {
        kind: "toggle-expand",
        id: activeId,
        expanded: true
      };
    }
    const child = rows[activeIndex + 1];

    return child?.parentId === activeId ? {
      kind: "select",
      id: child.node.id
    } :
      null;
  }
  if (key === "ArrowLeft") {
    if (activeRow.node.children !== undefined && expanded.has(activeId)) {
      return {
        kind: "toggle-expand",
        id: activeId,
        expanded: false
      };
    }

    return activeRow.parentId === null ? null : {
      kind: "select",
      id: activeRow.parentId
    };
  }
  if (key === "F2" && renamableIds.has(activeId)) {
    return {
      kind: "rename",
      id: activeId
    };
  }
  if (key === "Enter") {
    return {
      kind: "activate",
      id: activeId
    };
  }
  if (key === " " && reorderable) {
    return {
      kind: "interaction",
      interaction: beginKeyboardMove(rows, selected, activeId)
    };
  }

  return null;
}

function resolveMoveKey<TData>(
  key: string,
  interaction: TreeInteraction,
  rows: readonly FlatTreeRow<TData>[]
): TreeKeyAction | null {
  switch (key) {
    case "ArrowDown":
    case "ArrowUp":
      return {
        kind: "interaction",
        interaction: moveKeyboardCursor(
          interaction,
          rows,
          key === "ArrowDown" ? 1 : -1
        )
      };
    case "ArrowLeft":
    case "ArrowRight":
      return {
        kind: "interaction",
        interaction: cycleKeyboardDropWhere(
          interaction,
          key === "ArrowRight" ? 1 : -1
        )
      };
    case "Enter":
      return { kind: "commit-move" };
    case "Escape":
      return {
        kind: "interaction",
        interaction: idleTreeInteraction()
      };
    default:
      return null;
  }
}
