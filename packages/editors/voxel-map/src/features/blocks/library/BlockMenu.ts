// Import Third-party Dependencies
import {
  MenuSession,
  disableEntries,
  type MenuEntry,
  type MenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapMaterial } from "../../materials/MapMaterial.ts";

// CONSTANTS
const kMaterialPrefix = "material:";
const kItems = {
  edit: {
    id: "edit",
    label: "Edit…",
    icon: "block-edit"
  },
  duplicate: {
    id: "duplicate",
    label: "Duplicate",
    icon: "block-duplicate"
  },
  "new-material": {
    id: "new-material",
    label: "New material",
    icon: "plus"
  },
  "remove-material": {
    id: "remove-material",
    label: "Remove material",
    icon: "close"
  },
  "copy-id": {
    id: "copy-id",
    label: "Copy block ID",
    icon: "copy"
  },
  "remove-voxels": {
    id: "remove-voxels",
    label: "Remove voxels…",
    icon: "eraser",
    intent: "danger"
  },
  delete: {
    id: "delete",
    label: "Delete",
    icon: "trash",
    intent: "danger"
  }
} satisfies { [TCommand in BlockCommand]: MenuItem<TCommand>; };

export const LIBRARY_MENU: readonly MenuEntry<"create">[] = [
  {
    id: "create",
    label: "New block…",
    icon: "plus"
  }
];

export type BlockCommand =
  | "edit"
  | "duplicate"
  | "new-material"
  | "remove-material"
  | "copy-id"
  | "remove-voxels"
  | "delete";

export type BlockMenuScope = "blocks" | "materials";

type MaterialChoice = `${typeof kMaterialPrefix}${string}`;
type BlockMenuAction = BlockCommand | MaterialChoice;

export interface BlockMenuTarget {
  blockId: number;
  materials: readonly MapMaterial[];
  editable: boolean;
  clearable: boolean;
}

export interface BlockMenuHandlers {
  exists(): boolean;
  run(command: BlockCommand): Promise<void> | void;
  assign(material: MapMaterial): void;
}

export class BlockMenu {
  readonly #target: BlockMenuTarget;
  readonly #choices: ReadonlyMap<string, MapMaterial>;

  constructor(
    target: BlockMenuTarget
  ) {
    this.#target = target;
    this.#choices = new Map(
      target.materials.map((material) => [choiceId(material), material])
    );
  }

  session(
    scope: BlockMenuScope,
    handlers: BlockMenuHandlers
  ): MenuSession {
    return MenuSession.forRow(
      this.#entries(scope),
      () => handlers.exists(),
      (action) => {
        if (!isMaterialChoice(action)) {
          return handlers.run(action);
        }

        const material = this.#choices.get(action);

        return material === undefined ? undefined : handlers.assign(material);
      }
    );
  }

  #entries(
    scope: BlockMenuScope
  ): MenuEntry<BlockMenuAction>[] {
    const { editable, clearable } = this.#target;
    const shared: MenuEntry<BlockMenuAction>[] = [
      ...this.#materialEntries(),
      "separator",
      kItems["copy-id"]
    ];
    const entries: MenuEntry<BlockMenuAction>[] = scope === "materials" ?
      shared :
      [
        kItems.edit,
        kItems.duplicate,
        "separator",
        ...shared,
        "separator",
        kItems["remove-voxels"],
        kItems.delete
      ];

    return disableEntries(entries, (action) => {
      switch (action) {
        case "copy-id":
          return false;
        case "remove-voxels":
          return !clearable;
        default:
          return !editable;
      }
    });
  }

  #materialEntries(): MenuEntry<BlockMenuAction>[] {
    const { blockId, materials } = this.#target;
    const current = materials.find((material) => material.usedBy(blockId));
    const choices = materials.map((material): MenuItem<MaterialChoice> => {
      return {
        id: choiceId(material),
        label: material.name,
        ...(material === current ?
          {
            icon: "check",
            disabled: true
          } :
          {})
      };
    });

    return [
      {
        id: "material",
        label: "Material",
        icon: "material",
        items: [
          ...choices,
          ...(choices.length > 0 ? ["separator" as const] : []),
          kItems["new-material"]
        ]
      },
      ...(current === undefined ? [] : [kItems["remove-material"]])
    ];
  }
}

function choiceId(
  material: MapMaterial
): MaterialChoice {
  return `${kMaterialPrefix}${material.id}`;
}

function isMaterialChoice(
  action: BlockMenuAction
): action is MaterialChoice {
  return action.startsWith(kMaterialPrefix);
}
