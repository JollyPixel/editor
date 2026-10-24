// Import Third-party Dependencies
import {
  disableEntries,
  type MenuEntry,
  type MenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { EditorTargets } from "../session/EditorTargets.ts";
import type { EditorToolbarArchives } from "../session/EditorToolbarSources.ts";

// CONSTANTS
const kItems = {
  rename: {
    id: "rename",
    label: "Rename…",
    icon: "asset-rename"
  },
  export: {
    id: "export",
    label: "Export as .zip",
    icon: "asset-export"
  },
  import: {
    id: "import",
    label: "Import archive…",
    icon: "asset-import"
  },
  delete: {
    id: "delete",
    label: "Delete…",
    icon: "asset-delete",
    intent: "danger"
  },
  reset: {
    id: "reset",
    label: "Reset offline data…",
    icon: "revert",
    intent: "danger"
  }
} satisfies {
  [TAction in AssetAction]: MenuItem<TAction>;
};

export type AssetAction = "rename" | "export" | "import" | "delete" | "reset";

export class AssetMenu {
  readonly #targets: EditorTargets;
  readonly #archives: EditorToolbarArchives;

  constructor(
    targets: EditorTargets,
    archives: EditorToolbarArchives
  ) {
    this.#targets = targets;
    this.#archives = archives;
  }

  get entries(): MenuEntry<AssetAction>[] {
    const archives = this.#archives;
    const entries: MenuEntry<AssetAction>[] = [
      kItems.rename,
      kItems.export,
      ...archives.canImport ? [kItems.import] : [],
      "separator",
      kItems.delete,
      ...archives.canReset ? [kItems.reset] : []
    ];

    return disableEntries(
      entries,
      (action) => action === "delete" && !this.#targets.canRemoveCurrent
    );
  }

  run(
    action: AssetAction
  ): Promise<void> {
    switch (action) {
      case "rename":
        return this.#targets.renameCurrent();
      case "export":
        return this.#archives.download();
      case "import":
        return this.#archives.pickAndImport();
      case "delete":
        return this.#targets.removeCurrent();
      case "reset":
        return this.#archives.reset();
      default:
        return action satisfies never;
    }
  }
}
