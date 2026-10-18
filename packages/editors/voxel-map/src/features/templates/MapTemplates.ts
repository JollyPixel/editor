// Import Third-party Dependencies
import type {
  VoxelTemplate,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import {
  showConfirm,
  showPrompt,
  type LogQueue
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../document/MapDocument.ts";
import type { MapAccessSource } from "../../access/MapAccess.ts";
import { TemplateStore } from "./TemplateStore.ts";

export type TemplateWorld = Pick<VoxelWorld, "templates">;

export interface MapTemplatesOptions {
  world: TemplateWorld;
  mapDocument: MapDocumentSignals;
  access: MapAccessSource;
  log: Pick<LogQueue, "push">;
  store?: TemplateStore;
  confirm?: typeof showConfirm;
  prompt?: typeof showPrompt;
}

export class MapTemplates {
  readonly store: TemplateStore;

  readonly #world: TemplateWorld;
  readonly #access: MapAccessSource;
  readonly #log: Pick<LogQueue, "push">;
  readonly #confirm: typeof showConfirm;
  readonly #prompt: typeof showPrompt;
  readonly #unsubscribe: () => void;

  constructor(
    options: MapTemplatesOptions
  ) {
    this.#world = options.world;
    this.#access = options.access;
    this.#log = options.log;
    this.store = options.store ?? new TemplateStore();
    this.#confirm = options.confirm ?? showConfirm;
    this.#prompt = options.prompt ?? showPrompt;
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

    const templateId = this.#select(
      this.#world.templates.createFromLayer(layerName, {
        name: layerName
      })
    );
    if (templateId === null) {
      this.#log.push(`${layerName} has no voxels to save as a template`);
    }

    return templateId;
  }

  async saveSnapshot(
    snapshot: VoxelTemplate,
    suggestedName: string
  ): Promise<string | null> {
    if (!this.editable) {
      return null;
    }

    const name = await this.#prompt({
      title: "Save as template",
      icon: "template-save",
      label: "Name",
      defaultValue: suggestedName,
      confirmLabel: "Save"
    });
    if (name === null || name === "" || !this.editable) {
      return null;
    }

    return this.#select(
      this.#world.templates.createFromSnapshot(snapshot, {
        name
      })
    );
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

  #select(
    template: VoxelTemplate | undefined
  ): string | null {
    if (template === undefined) {
      return null;
    }
    this.store.selected = template.id;

    return template.id;
  }

  readonly #reconcile = (): void => {
    this.store.reconcile(
      Array.from(this.#world.templates, (template) => template.id)
    );
  };
}
