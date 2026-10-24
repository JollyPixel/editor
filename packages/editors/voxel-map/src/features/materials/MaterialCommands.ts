// Import Third-party Dependencies
import { formatCount } from "@jolly-pixel/ui";
import { showConfirm } from "@jolly-pixel/ui/elements/dialog";
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapMaterial } from "./MapMaterial.ts";
import type { MapMaterials } from "./MapMaterials.ts";

export type MaterialCommand =
  | "apply"
  | "unapply"
  | "rename"
  | "duplicate"
  | "reset"
  | "delete";

export interface MaterialCommandsOptions {
  materials: Pick<
    MapMaterials,
    "assign" | "duplicate" | "resetFinish" | "remove"
  >;
  selectedBlock(): ResolvedBlockDefinition | undefined;
  rename(materialId: string): void;
  select(materialId: string | null): Promise<void>;
}

type Commands = {
  [TCommand in MaterialCommand]: (
    material: MapMaterial
  ) => Promise<void> | void;
};

export class MaterialCommands {
  readonly #options: MaterialCommandsOptions;

  readonly #commands: Commands = {
    apply: (material) => this.#assign(material.id),
    unapply: () => this.#assign(null),
    rename: (material) => this.#options.rename(material.id),
    duplicate: (material) => this.#duplicate(material),
    reset: (material) => {
      this.#options.materials.resetFinish(material);
    },
    delete: (material) => this.#remove(material)
  };

  constructor(
    options: MaterialCommandsOptions
  ) {
    this.#options = options;
  }

  run(
    command: MaterialCommand,
    material: MapMaterial
  ): Promise<void> | void {
    return this.#commands[command](material);
  }

  #assign(
    groupId: string | null
  ): void {
    const block = this.#options.selectedBlock();
    if (block !== undefined) {
      this.#options.materials.assign(block.id, groupId);
    }
  }

  async #duplicate(
    material: MapMaterial
  ): Promise<void> {
    const copyId = this.#options.materials.duplicate(material);
    if (copyId !== null) {
      await this.#options.select(copyId);
    }
  }

  async #remove(
    material: MapMaterial
  ): Promise<void> {
    const users = material.blockIds.length;
    const confirmed = users <= 1 || await showConfirm({
      title: "Delete material",
      message: `${material.name} is used by ${formatCount(users, "block")}. ` +
        "They will have no material.",
      confirmLabel: "Delete",
      icon: "trash",
      danger: true
    });
    if (confirmed) {
      this.#options.materials.remove(material);
      await this.#options.select(null);
    }
  }
}
