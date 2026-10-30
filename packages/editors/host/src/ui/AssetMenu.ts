// Import Third-party Dependencies
import { AssetPath } from "@jolly-pixel/asset";
import {
  disableEntries,
  type MenuEntry,
  type MenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { EditorTargets } from "../session/EditorTargets.ts";
import type { EditorToolbarArchives } from "../session/EditorToolbarSources.ts";

// CONSTANTS
const kDependencyPrefix = "dependency:";
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
  [TAction in AssetCommand]: MenuItem<TAction>;
};

type AssetCommand = "rename" | "export" | "import" | "delete" | "reset";
type DependencyExport = `${typeof kDependencyPrefix}${string}`;

export type AssetAction = AssetCommand | DependencyExport;

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
      ...this.#dependencyBranch(),
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
    if (isDependencyExport(action)) {
      return this.#archives.downloadAsset(
        action.slice(kDependencyPrefix.length)
      );
    }

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

  #dependencyBranch(): MenuEntry<AssetAction>[] {
    const items = this.#archives.dependencies.map(
      (record): MenuItem<AssetAction> => {
        return {
          id: `${kDependencyPrefix}${record.id}`,
          label: new AssetPath(record.path).withoutExtension().toString()
        };
      }
    );

    return items.length === 0 ? [] : [
      {
        id: "dependencies",
        label: "Export dependency",
        icon: "asset-export",
        items
      }
    ];
  }
}

function isDependencyExport(
  action: AssetAction
): action is DependencyExport {
  return action.startsWith(kDependencyPrefix);
}
