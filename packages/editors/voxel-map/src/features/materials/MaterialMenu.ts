// Import Third-party Dependencies
import {
  MenuSession,
  disableEntries,
  type MenuEntry,
  type MenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { SelectedBlockUse } from "./MapMaterial.ts";
import type { MaterialCommand } from "./MaterialCommands.ts";

// CONSTANTS
const kItems = {
  apply: {
    id: "apply",
    label: "Apply to selected block",
    icon: "material"
  },
  unapply: {
    id: "unapply",
    label: "Remove from selected block",
    icon: "close"
  },
  rename: {
    id: "rename",
    label: "Rename",
    icon: "pencil"
  },
  duplicate: {
    id: "duplicate",
    label: "Duplicate",
    icon: "copy"
  },
  reset: {
    id: "reset",
    label: "Reset finish",
    icon: "revert"
  },
  delete: {
    id: "delete",
    label: "Delete",
    icon: "trash",
    intent: "danger"
  }
} satisfies { [TCommand in MaterialCommand]: MenuItem<TCommand>; };

export const SHELF_MENU: readonly MenuEntry<"create">[] = [
  {
    id: "create",
    label: "New material",
    icon: "plus"
  }
];

export interface MaterialMenuTarget {
  editable: boolean;
  pristine: boolean;
  blockUse: SelectedBlockUse["kind"];
}

export interface MaterialMenuHandlers {
  exists(): boolean;
  run(command: MaterialCommand): Promise<void> | void;
}

export class MaterialMenu {
  readonly #target: MaterialMenuTarget;

  constructor(
    target: MaterialMenuTarget
  ) {
    this.#target = target;
  }

  session(
    handlers: MaterialMenuHandlers
  ): MenuSession {
    return MenuSession.forRow(
      this.#entries(),
      () => handlers.exists(),
      (command) => handlers.run(command)
    );
  }

  #entries(): MenuEntry<MaterialCommand>[] {
    const { editable, pristine, blockUse } = this.#target;
    const entries: MenuEntry<MaterialCommand>[] = [
      blockUse === "unapply" ? kItems.unapply : kItems.apply,
      "separator",
      kItems.rename,
      kItems.duplicate,
      kItems.reset,
      "separator",
      kItems.delete
    ];

    return disableEntries(entries, (command) => {
      switch (command) {
        case "apply":
          return blockUse !== "apply";
        case "unapply":
          return false;
        case "reset":
          return !editable || pristine;
        default:
          return !editable;
      }
    });
  }
}
