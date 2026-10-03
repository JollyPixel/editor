// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import {
  materialSurfaceChanges,
  type MaterialSurfacePatchJSON,
  type ModelDocument,
  type ModelMaterialJSON
} from "@jolly-pixel/asset.voxel-model/client";
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  MaterialFocusStore,
  MaterialPreviews,
  PresenceStore,
  ViewSettingsStore
} from "../../../state/index.ts";
import { WorkspaceController } from "../../../shared/WorkspaceController.ts";

export interface MaterialSurfaceWorkspace {
  document: ModelDocument;
  materialFocus: MaterialFocusStore;
  presence: PresenceStore;
  previews: MaterialPreviews;
  view: ViewSettingsStore;
}

export class MaterialSurfaceController {
  #host: ReactiveControllerHost;
  #connection: WorkspaceController<MaterialSurfaceWorkspace>;
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
    this.#connection = new WorkspaceController(
      host,
      (workspace) => this.#subscribeTo(workspace)
    );
  }

  get #workspace(): MaterialSurfaceWorkspace | null {
    return this.#connection.current;
  }

  get edited(): ModelMaterialJSON | null {
    const material = this.#stored();
    const previews = this.#workspace?.previews;
    if (material === undefined || previews === undefined) {
      return null;
    }

    return {
      ...material,
      surface: previews.surfaceOf(material.id, material.surface)
    };
  }

  get editors(): readonly PresencePeer[] {
    return this.#materialId === null ?
      [] :
      this.#workspace?.presence.materialEdits.get(this.#materialId) ?? [];
  }

  get lit(): boolean {
    return this.#workspace?.view.settings.shading !== "flat";
  }

  attach(
    workspace: MaterialSurfaceWorkspace
  ): void {
    this.#connection.attach(workspace);
    this.#onEdit(workspace.materialFocus.edited);
  }

  readonly preview = (
    changes: MaterialSurfacePatchJSON
  ): void => {
    const previews = this.#workspace?.previews;
    const materialId = this.#stored()?.id;
    if (previews === undefined || materialId === undefined) {
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
    const workspace = this.#workspace;
    const stored = this.#stored();
    if (workspace === null || stored === undefined) {
      return;
    }

    const changed = materialSurfaceChanges(stored.surface, {
      ...stored.surface,
      ...changes
    });
    if (Object.keys(changed).length > 0) {
      workspace.document.changeMaterial(stored.id, changed);
    }
    workspace.previews.end(stored.id, null);
  };

  #stored(): ModelMaterialJSON | undefined {
    return this.#materialId === null ?
      undefined :
      this.#workspace?.document.tree.materials.material(this.#materialId);
  }

  #endPreview(): void {
    if (this.#materialId !== null) {
      this.#workspace?.previews.end(this.#materialId, null);
    }
  }

  #subscribeTo(
    workspace: MaterialSurfaceWorkspace
  ): Array<() => void> {
    const {
      document,
      materialFocus,
      presence,
      previews,
      view
    } = workspace;

    return [
      document.subscribe("change", this.#onUpdate),
      materialFocus.subscribe("edit", this.#onEdit),
      view.subscribe("change", this.#onUpdate),
      previews.subscribe("change", this.#onUpdate),
      presence.subscribe("materialEditsChange", this.#onUpdate),
      () => this.#endPreview()
    ];
  }
}
