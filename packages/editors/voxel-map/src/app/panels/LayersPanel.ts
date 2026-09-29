// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";

// Import Internal Dependencies
import type { LayerSelection } from "../../state/index.ts";
import type { VoxelMapWorkspace } from "../../scene/EditorScene.ts";
import { WorkspaceController } from "../../shared/WorkspaceController.ts";
import type { LayerManager } from "../../features/layers/LayerManager.ts";
import type { TemplateManager } from "../../features/templates/TemplateManager.ts";
import {
  removeTemplate,
  saveLayerAsTemplate
} from "../../features/templates/templateActions.ts";
import { formatCount } from "../../features/blocks/blockUsage.ts";

import "../../features/registerElements.ts";

@customElement("layers-panel")
export class LayersPanel extends LitElement {
  static override styles = css`
    :host {
      display: block;

      --jolly-folder-indent: 0;
      --jolly-field-inset-end: 0;
    }

    layer-manager {
      min-height: calc(var(--jolly-row-height, 20px) * 3);
      max-height: 200px;
    }

    template-manager {
      max-height: 160px;
    }

    .total {
      align-self: center;
      margin-inline-end: var(--jolly-space-1, 4px);
      color: var(--jolly-text-muted);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .hint {
      margin: 0;
      padding: var(--jolly-space-1, 4px);
      color: var(--jolly-text-muted);
    }
  `;

  @state()
  declare _selection: LayerSelection | null;

  @query("jolly-folder")
  declare _folder: HTMLElementTagNameMap["jolly-folder"] | null;

  @state()
  declare _template: string | null;

  @query("layer-manager")
  declare _layerManager: LayerManager | null;

  @query("template-manager")
  declare _templateManager: TemplateManager | null;

  #workspace = new WorkspaceController(this, (workspace) => {
    const { selection, templates } = workspace.state;
    this._selection = selection.current;
    this._template = templates.selected;

    return [
      selection.subscribe("change", (current) => {
        this._selection = current;
      }),
      templates.subscribe("selectionChange", (templateId) => {
        this._template = templateId;
      }),
      workspace.usage.subscribe("change", () => this.requestUpdate()),
      workspace.mapDocument.subscribe("reset", () => this.requestUpdate())
    ];
  });

  constructor() {
    super();
    this._selection = null;
    this._template = null;
  }

  attach(
    workspace: VoxelMapWorkspace
  ): void {
    this.#workspace.attach(workspace);
  }

  readonly #addLayer = async(): Promise<void> => {
    if (this._folder !== null && !this._folder.open) {
      this._folder.open = true;
    }
    await this._layerManager?.addLayer();
  };

  readonly #removeLayer = async(): Promise<void> => {
    await this._layerManager?.removeLayer();
  };

  readonly #cloneLayer = (): void => {
    this._layerManager?.cloneLayer();
  };

  readonly #mergeLayer = async(): Promise<void> => {
    await this._layerManager?.mergeLayer();
  };

  readonly #saveTemplate = (): void => {
    const workspace = this.#workspace.current;
    const layerName = workspace?.state.selection.voxelLayer ?? null;
    if (workspace === null || layerName === null) {
      return;
    }

    const templateId = saveLayerAsTemplate(
      workspace.engine.document.world,
      workspace.state.templates,
      layerName
    );
    if (templateId === null) {
      workspace.state.log.push(`${layerName} has no voxels to save as a template`);
    }
  };

  readonly #placeTemplate = (): void => {
    this._templateManager?.place();
  };

  readonly #removeTemplate = async(): Promise<void> => {
    const workspace = this.#workspace.current;
    if (workspace === null || this._template === null) {
      return;
    }

    await removeTemplate(workspace.engine.document.world, this._template);
  };

  get #canEditVoxelLayer(): boolean {
    return this._selection?.kind === "voxel-layer";
  }

  get #canMergeVoxelLayer(): boolean {
    return this.#canEditVoxelLayer &&
      this.#workspace.attached.engine.document.world.getLayers().length > 1;
  }

  override render() {
    const workspace = this.#workspace.current;
    if (workspace === null) {
      return nothing;
    }

    return html`
      <jolly-folder
        key="layers"
        label="Layers"
        storage-key="voxel-map:folder:layers"
      >
        <span
          slot="actions"
          class="total"
          title="Voxels placed in the map"
        >${formatCount(workspace.usage.stats.voxels, "voxel")}</span>
        <jolly-button
          slot="actions"
          icon="plus"
          icon-only
          label="Add layer"
          title="Add layer"
          @click=${this.#addLayer}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="copy"
          icon-only
          label="Clone layer"
          title="Clone layer"
          ?disabled=${!this.#canEditVoxelLayer}
          @click=${this.#cloneLayer}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="merge"
          icon-only
          label="Merge layer"
          title="Merge layer into another"
          ?disabled=${!this.#canMergeVoxelLayer}
          @click=${this.#mergeLayer}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="trash"
          icon-only
          variant="danger"
          label="Remove layer"
          title="Remove layer"
          ?disabled=${this._selection === null}
          @click=${this.#removeLayer}
        ></jolly-button>

        <layer-manager
          .world=${workspace.engine.document.world}
          .selection=${workspace.state.selection}
          .mapDocument=${workspace.mapDocument}
          .presence=${workspace.state.presence}
          .layerVisibility=${workspace.state.layerVisibility}
          .viewFocus=${workspace.viewFocus}
        ></layer-manager>
        ${this.#renderSelectionPanel(workspace)}
      </jolly-folder>

      <jolly-folder
        key="templates"
        label="Templates"
        storage-key="voxel-map:folder:templates"
      >
        <jolly-button
          slot="actions"
          icon="template-save"
          icon-only
          label="Save layer as template"
          title="Save the selected voxel layer as a template"
          ?disabled=${!this.#canEditVoxelLayer}
          @click=${this.#saveTemplate}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="stamp"
          icon-only
          label="Place template"
          title="Place the selected template in the world"
          ?disabled=${this._template === null}
          @click=${this.#placeTemplate}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="trash"
          icon-only
          variant="danger"
          label="Delete template"
          title="Delete template"
          ?disabled=${this._template === null}
          @click=${this.#removeTemplate}
        ></jolly-button>

        <template-manager
          .world=${workspace.engine.document.world}
          .templates=${workspace.state.templates}
          .mapDocument=${workspace.mapDocument}
          .viewFocus=${workspace.viewFocus}
        ></template-manager>
        <template-panel
          .world=${workspace.engine.document.world}
          .history=${workspace.engine.document.history}
          .templates=${workspace.state.templates}
          .selection=${workspace.state.selection}
          .mapDocument=${workspace.mapDocument}
        ></template-panel>
      </jolly-folder>
    `;
  }

  #renderSelectionPanel(
    workspace: VoxelMapWorkspace
  ) {
    const selection = this._selection;
    if (selection === null) {
      return nothing;
    }

    switch (selection.kind) {
      case "voxel-layer":
        return html`<layer-panel
          .world=${workspace.engine.document.world}
          .selection=${workspace.state.selection}
          .mapDocument=${workspace.mapDocument}
          .layerName=${selection.name}
        ></layer-panel>`;
      case "object":
        return html`<object-panel
          .world=${workspace.engine.document.world}
          .mapDocument=${workspace.mapDocument}
          .layerName=${selection.layerName}
          .objectId=${selection.objectId}
        ></object-panel>`;
      default:
        return html`<p class="hint">
          Select an object to edit its properties.
        </p>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "layers-panel": LayersPanel;
  }
}
