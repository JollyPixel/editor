// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelHistory,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { showConfirm } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { TemplateStore } from "./TemplateStore.ts";

export type TemplateWorld = Pick<VoxelWorld, "templates">;

export interface MapTemplatesOptions {
  world: TemplateWorld;
  history: Pick<VoxelHistory, "begin" | "commit">;
  store?: TemplateStore;
  confirm?: typeof showConfirm;
}

export class MapTemplates {
  readonly store: TemplateStore;

  readonly #world: TemplateWorld;
  readonly #history: Pick<VoxelHistory, "begin" | "commit">;
  readonly #confirm: typeof showConfirm;

  constructor(
    options: MapTemplatesOptions
  ) {
    this.#world = options.world;
    this.#history = options.history;
    this.store = options.store ?? new TemplateStore();
    this.#confirm = options.confirm ?? showConfirm;
  }

  saveLayer(
    layerName: string
  ): string | null {
    const template = this.#world.templates.createFromLayer(layerName, {
      name: layerName
    });
    if (template === undefined) {
      return null;
    }
    this.store.selected = template.id;

    return template.id;
  }

  rename(
    templateId: string,
    name: string
  ): boolean {
    const trimmed = name.trim();

    return trimmed !== "" &&
      this.#world.templates.update(templateId, { name: trimmed });
  }

  async remove(
    templateId: string
  ): Promise<boolean> {
    const template = this.#world.templates.get(templateId);
    if (template === undefined) {
      return false;
    }

    const confirmed = await this.#confirm({
      title: "Delete template",
      message: `Delete "${template.name}"? Voxels already placed stay in their layers.`,
      confirmLabel: "Delete",
      icon: "trash",
      danger: true
    });

    return confirmed && this.#world.templates.remove(templateId);
  }

  beginPlacement(
    templateId: string,
    position: VoxelCoord
  ): boolean {
    if (this.#world.templates.get(templateId) === undefined) {
      return false;
    }
    this.store.beginPlacement(templateId, position);

    return true;
  }

  commitPlacement(
    layerName: string | null
  ): boolean {
    const { placement } = this.store;
    if (placement === null || layerName === null) {
      return false;
    }

    this.#history.begin();
    let placed = false;
    try {
      placed = this.#world.templates.place(placement.templateId, {
        layerName,
        position: placement.position,
        transform: placement.transform
      });
    }
    finally {
      this.#history.commit();
    }
    if (placed) {
      this.store.endPlacement();
    }

    return placed;
  }
}
