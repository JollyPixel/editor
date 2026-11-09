// Import Third-party Dependencies
import {
  findNode,
  type MenuItem,
  type TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  subtreeBlockIds,
  type HierarchyNode
} from "../../model/index.ts";
import type { ModelBlocks } from "../../scene/index.ts";
import type { ExpandedRows } from "../../shared/ExpandedRows.ts";
import type { MenuActions } from "../../shared/menu/MenuActions.ts";
import { collectExpandableIds } from "./hierarchyTreeNodes.ts";

// CONSTANTS
const kFocus = {
  id: "focus",
  label: "Focus",
  icon: "hierarchy-focus"
};
const kIsolate = {
  id: "isolate",
  label: "Isolate",
  icon: "hierarchy-isolate"
};
const kShowAll = {
  id: "show-all",
  label: "Show All",
  icon: "eye"
};
const kExpandAll = {
  id: "expand-all",
  label: "Expand All"
};
const kCollapseAll = {
  id: "collapse-all",
  label: "Collapse All"
};

export interface HierarchyViewEditing {
  blocks: ModelBlocks;
  frameBlocks(uuids: Iterable<string>): void;
}

export interface HierarchyViewMenuOptions {
  expanded: ExpandedRows;
  nodes(): readonly TreeNode[];
  requestUpdate(): void;
}

export class HierarchyViewMenu {
  readonly #options: HierarchyViewMenuOptions;

  constructor(
    options: HierarchyViewMenuOptions
  ) {
    this.#options = options;
  }

  focusEntries(
    menu: MenuActions,
    editing: HierarchyViewEditing,
    node: HierarchyNode
  ): MenuItem<string>[] {
    const blockIds = [...subtreeBlockIds(node)];
    const disabled = blockIds.length === 0;

    return [
      menu.item(
        {
          ...kFocus,
          disabled
        },
        () => editing.frameBlocks(blockIds)
      ),
      menu.item(
        {
          ...kIsolate,
          disabled
        },
        () => editing.blocks.showOnly(blockIds)
      )
    ];
  }

  showAllEntry(
    menu: MenuActions,
    editing: HierarchyViewEditing
  ): MenuItem<string> {
    const hidden = [...editing.blocks.values()]
      .filter((block) => !block.visible)
      .map((block) => block.uuid);

    return menu.item(
      {
        ...kShowAll,
        disabled: hidden.length === 0
      },
      () => editing.blocks.changeVisibility(hidden, true)
    );
  }

  expansionEntries(
    menu: MenuActions,
    id: string | null
  ): MenuItem<string>[] {
    const { expanded } = this.#options;
    const ids = this.#expandableIds(id);

    return [
      menu.item(
        {
          ...kExpandAll,
          disabled: ids.every((rowId) => expanded.has(rowId))
        },
        () => this.#expandAll(ids, true)
      ),
      menu.item(
        {
          ...kCollapseAll,
          disabled: !ids.some((rowId) => expanded.has(rowId))
        },
        () => this.#expandAll(ids, false)
      )
    ];
  }

  #expandAll(
    ids: readonly string[],
    expanded: boolean
  ): void {
    for (const id of ids) {
      this.#options.expanded.toggle(id, expanded);
    }
    this.#options.requestUpdate();
  }

  #expandableIds(
    id: string | null
  ): string[] {
    const nodes = this.#options.nodes();
    if (id === null) {
      return collectExpandableIds(nodes);
    }

    const node = findNode(nodes, id);

    return node === null ? [] : collectExpandableIds([node]);
  }
}
