// Import Third-party Dependencies
import {
  formatCount,
  type MenuBranch,
  type MenuItem
} from "@jolly-pixel/ui";
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { ModelAccessSignals } from "../../access/ModelAccess.ts";
import type { ScopeRecorder } from "../history/index.ts";
import type { MenuActions } from "../../shared/menu/MenuActions.ts";
import { surfaceSwatch } from "../material/materialSwatch.ts";
import { presetMenuItems } from "../material/library/materialIcons.ts";
import type { MaterialPreset } from "../material/library/materialPresets.ts";

export interface HierarchyMaterialsEditing {
  access: ModelAccessSignals;
  document: ModelDocument;
  history: ScopeRecorder<"material">;
}

export interface MaterialTarget {
  blockIds: readonly string[];
  reveal(): void;
}

export class HierarchyMaterials {
  #copied: string | null = null;

  blockBranch(
    menu: MenuActions,
    editing: HierarchyMaterialsEditing,
    target: MaterialTarget
  ): MenuBranch<string> {
    const shared = sharedMaterial(editing.document, target.blockIds);

    return menu.branch(
      {
        id: "material-menu",
        label: "Material",
        icon: "material"
      },
      [
        menu.item(
          {
            id: "material",
            label: "Edit Material…",
            icon: "material"
          },
          target.reveal
        ),
        "separator",
        ...assignItems(menu, editing, target),
        "separator",
        menu.branch(
          {
            id: "new-material",
            label: "New Material",
            icon: "plus",
            disabled: isLocked(editing, target)
          },
          presetMenuItems(menu, (preset) => create(editing, target, preset))
        ),
        "separator",
        menu.item(
          {
            id: "copy-material",
            label: "Copy Material",
            icon: "copy",
            disabled: shared === null
          },
          () => {
            this.#copied = shared;
          }
        ),
        this.#pasteItem(menu, editing, target)
      ]
    );
  }

  folderBranch(
    menu: MenuActions,
    editing: HierarchyMaterialsEditing,
    target: MaterialTarget
  ): MenuBranch<string> {
    return menu.branch(
      {
        id: "material-menu",
        label: "Apply Material",
        icon: "material"
      },
      [
        ...assignItems(menu, editing, target),
        "separator",
        this.#pasteItem(menu, editing, target)
      ]
    );
  }

  #pasteItem(
    menu: MenuActions,
    editing: HierarchyMaterialsEditing,
    target: MaterialTarget
  ): MenuItem<string> {
    const { document } = editing;
    const copied = this.#copied;
    const pastable = copied !== null &&
      document.tree.materials.material(copied) !== undefined;

    return menu.item(
      {
        id: "paste-material",
        label: "Paste Material",
        icon: "paste",
        disabled: !pastable ||
          isLocked(editing, target) ||
          allAssigned(document, target.blockIds, copied)
      },
      () => copied !== null && assign(editing, target, copied)
    );
  }
}

function assignItems(
  menu: MenuActions,
  editing: HierarchyMaterialsEditing,
  target: MaterialTarget
): MenuItem<string>[] {
  const { document } = editing;
  const locked = isLocked(editing, target);

  return [
    menu.item(
      {
        id: "unassign",
        label: "None",
        disabled: locked || allAssigned(document, target.blockIds, null)
      },
      () => assign(editing, target, null)
    ),
    ...[...document.tree.materials.materials()].map((material) => menu.item(
      {
        id: `assign:${material.id}`,
        label: material.name,
        swatch: surfaceSwatch(material.surface),
        disabled: locked || allAssigned(document, target.blockIds, material.id)
      },
      () => assign(editing, target, material.id)
    ))
  ];
}

function assign(
  editing: HierarchyMaterialsEditing,
  target: MaterialTarget,
  materialId: string | null
): void {
  const { document } = editing;
  if (
    materialId !== null &&
    document.tree.materials.material(materialId) === undefined
  ) {
    return;
  }

  const changed = editing.history.record(
    "material",
    assignLabel(document, materialId, target.blockIds),
    () => assignAll(document, target.blockIds, materialId)
  );
  if (changed) {
    target.reveal();
  }
}

function create(
  editing: HierarchyMaterialsEditing,
  target: MaterialTarget,
  preset: MaterialPreset
): void {
  const { document } = editing;
  const changed = editing.history.record(
    "material",
    `Add material ${preset.label}`,
    () => {
      const materialId = document.addMaterial({
        name: preset.label,
        surface: preset.surface
      });

      return materialId !== null &&
        assignAll(document, target.blockIds, materialId);
    }
  );
  if (changed) {
    target.reveal();
  }
}

function isLocked(
  editing: HierarchyMaterialsEditing,
  target: MaterialTarget
): boolean {
  return !editing.access.current.has("materials") ||
    target.blockIds.length === 0;
}

function assignedMaterial(
  document: ModelDocument,
  blockId: string
): string | null {
  return document.tree.nodes.block(blockId)?.materialId ?? null;
}

function allAssigned(
  document: ModelDocument,
  blockIds: readonly string[],
  materialId: string | null
): boolean {
  return blockIds.every(
    (id) => assignedMaterial(document, id) === materialId
  );
}

function sharedMaterial(
  document: ModelDocument,
  blockIds: readonly string[]
): string | null {
  const [first] = blockIds;
  if (first === undefined) {
    return null;
  }

  const materialId = assignedMaterial(document, first);

  return allAssigned(document, blockIds, materialId) ? materialId : null;
}

function assignAll(
  document: ModelDocument,
  blockIds: readonly string[],
  materialId: string | null
): boolean {
  let changed = false;
  for (const id of blockIds) {
    if (assignedMaterial(document, id) !== materialId) {
      changed = document.assignMaterial(id, materialId) || changed;
    }
  }

  return changed;
}

function assignLabel(
  document: ModelDocument,
  materialId: string | null,
  blockIds: readonly string[]
): string | null {
  if (blockIds.length < 2) {
    return null;
  }

  const name = materialId === null ?
    "no material" :
    document.tree.materials.material(materialId)?.name ?? "material";

  return `Set ${name} on ${formatCount(blockIds.length, "block")}`;
}
