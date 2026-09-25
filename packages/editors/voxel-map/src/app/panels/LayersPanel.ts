// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";

// Import Internal Dependencies
import type { LayerSelection } from "../../state/index.ts";
import type { VoxelMapWorkspace } from "../../scene/EditorScene.ts";
import { WorkspaceController } from "../../shared/WorkspaceController.ts";
import type { LayerManager } from "../../features/layers/LayerManager.ts";
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

  @query("layer-manager")
  declare _layerManager: LayerManager | null;

  #workspace = new WorkspaceController(this, (workspace) => {
    const { selection } = workspace.state;
    this._selection = selection.current;

    return [
      selection.subscribe("change", (current) => {
        this._selection = current;
      }),
      workspace.usage.subscribe("change", () => this.requestUpdate()),
      workspace.mapDocument.subscribe("reset", () => this.requestUpdate())
    ];
  });

  constructor() {
    super();
    this._selection = null;
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

  get #canEditVoxelLayer(): boolean {
    return this._selection?.kind === "voxel-layer";
  }

  get #canMergeVoxelLayer(): boolean {
    return this.#canEditVoxelLayer &&
      this.#workspace.attached.engine.world.getLayers().length > 1;
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
          .world=${workspace.engine.world}
          .selection=${workspace.state.selection}
          .mapDocument=${workspace.mapDocument}
          .presence=${workspace.state.presence}
          .layerVisibility=${workspace.state.layerVisibility}
          .viewFocus=${workspace.viewFocus}
          style="height:200px;"
        ></layer-manager>
        ${this.#renderSelectionPanel(workspace)}
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
          .world=${workspace.engine.world}
          .selection=${workspace.state.selection}
          .mapDocument=${workspace.mapDocument}
          .layerName=${selection.name}
        ></layer-panel>`;
      case "object":
        return html`<object-panel
          .world=${workspace.engine.world}
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
