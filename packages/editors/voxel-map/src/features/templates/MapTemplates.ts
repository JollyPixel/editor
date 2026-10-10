// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import { showConfirm } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../document/MapDocument.ts";
import type { MapAccessSource } from "../../access/MapAccess.ts";
import { TemplateStore } from "./TemplateStore.ts";

export type TemplateWorld = Pick<VoxelWorld, "templates">;

export interface MapTemplatesOptions {
  world: TemplateWorld;
  mapDocument: MapDocumentSignals;
  access: MapAccessSource;
  store?: TemplateStore;
  confirm?: typeof showConfirm;
}

export class MapTemplates {
  readonly store: TemplateStore;

  readonly #world: TemplateWorld;
  readonly #access: MapAccessSource;
  readonly #confirm: typeof showConfirm;
  readonly #unsubscribe: () => void;

  constructor(
    options: MapTemplatesOptions
  ) {
    this.#world = options.world;
    this.#access = options.access;
    this.store = options.store ?? new TemplateStore();
    this.#confirm = options.confirm ?? showConfirm;
    this.#unsubscribe = options.mapDocument.subscribe(
      "templatesChanged",
      this.#reconcile
    );
  }

  get editable(): boolean {
    return this.#access.current.has("templates");
  }

  dispose(): void {
    this.#unsubscribe();
  }

  saveLayer(
    layerName: string
  ): string | null {
    if (!this.editable) {
      return null;
    }

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

    return this.editable &&
      trimmed !== "" &&
      this.#world.templates.update(templateId, { name: trimmed });
  }

  async remove(
    templateId: string
  ): Promise<boolean> {
    const template = this.#world.templates.get(templateId);
    if (!this.editable || template === undefined) {
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

  readonly #reconcile = (): void => {
    this.store.reconcile(
      Array.from(this.#world.templates, (template) => template.id)
    );
  };
}
