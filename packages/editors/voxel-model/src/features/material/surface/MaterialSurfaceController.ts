// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import {
  MaterialSurface,
  type MaterialSurfacePatchJSON,
  type ModelDocument,
  type ModelMaterialJSON
} from "@jolly-pixel/asset.voxel-model/client";
import {
  SubscriptionController,
  type PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  isLit,
  type MaterialFocusStore,
  type MaterialPreviews,
  type PresenceStore,
  type ViewSettingsStore
} from "../../../state/index.ts";
import type { ModelAccessSignals } from "../../../access/ModelAccess.ts";

export interface MaterialSurfaceEditing {
  access: ModelAccessSignals;
  document: ModelDocument;
  materialFocus: MaterialFocusStore;
  presence: PresenceStore;
  previews: MaterialPreviews;
  view: ViewSettingsStore;
}

export class MaterialSurfaceController {
  #host: ReactiveControllerHost;
  #connection: SubscriptionController<MaterialSurfaceEditing>;
  #materialId: string | null = null;

  #onEdit = (
    materialId: string | null
  ): void => {
    this.#endPreview();
    this.#materialId = materialId;
    this.#host.requestUpdate();
  };

  #onUpdate = (): void => {
    this.#host.requestUpdate();
  };

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    this.#connection = new SubscriptionController(
      host,
      (editing) => this.#subscribeTo(editing)
    );
  }

  get #editing(): MaterialSurfaceEditing | null {
    return this.#connection.current;
  }

  get edited(): ModelMaterialJSON | null {
    const material = this.#stored();
    const previews = this.#editing?.previews;
    if (material === undefined || previews === undefined) {
      return null;
    }

    return {
      ...material,
      surface: previews.previewSurface(material.id, material.surface)
    };
  }

  get editors(): readonly PresencePeer[] {
    return this.#materialId === null ?
      [] :
      this.#editing?.presence.materialEdits.get(this.#materialId) ?? [];
  }

  get editable(): boolean {
    return this.#editing?.access.current.has("materials") ?? false;
  }

  get lit(): boolean {
    const view = this.#editing?.view;

    return view === undefined || isLit(view.settings);
  }

  attach(
    editing: MaterialSurfaceEditing
  ): void {
    this.#connection.attach(editing);
    this.#onEdit(editing.materialFocus.edited);
  }

  readonly preview = (
    changes: MaterialSurfacePatchJSON
  ): void => {
    const previews = this.#editing?.previews;
    const materialId = this.#stored()?.id;
    if (previews === undefined || materialId === undefined || !this.editable) {
      return;
    }

    previews.set(materialId, null, {
      ...previews.layer(materialId, null),
      ...changes
    });
  };

  readonly commit = (
    changes: MaterialSurfacePatchJSON
  ): void => {
    const editing = this.#editing;
    const stored = this.#stored();
    if (editing === null || stored === undefined) {
      return;
    }
    if (!this.editable) {
      editing.previews.end(stored.id, null);

      return;
    }

    const changed = new MaterialSurface(stored.surface).changesTo({
      ...stored.surface,
      ...changes
    });
    if (Object.keys(changed).length > 0) {
      editing.document.changeMaterial(stored.id, changed);
    }
    editing.previews.end(stored.id, null);
  };

  #stored(): ModelMaterialJSON | undefined {
    return this.#materialId === null ?
      undefined :
      this.#editing?.document.tree.materials.material(this.#materialId);
  }

  #endPreview(): void {
    if (this.#materialId !== null) {
      this.#editing?.previews.end(this.#materialId, null);
    }
  }

  #subscribeTo(
    editing: MaterialSurfaceEditing
  ): Array<() => void> {
    const {
      access,
      document,
      materialFocus,
      presence,
      previews,
      view
    } = editing;

    return [
      access.subscribe("change", this.#onUpdate),
      document.subscribe("change", this.#onUpdate),
      materialFocus.subscribe("edit", this.#onEdit),
      view.subscribe("change", this.#onUpdate),
      previews.subscribe("change", this.#onUpdate),
      presence.subscribe("materialEditsChange", this.#onUpdate),
      () => this.#endPreview()
    ];
  }
}
