// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type {
  VoxelEngine,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  editorState,
  type EditorState,
  type LayerSelection
} from "../state/index.ts";
import type { LayerManager } from "../../features/layers/LayerManager.ts";
import { formatCount } from "../../features/blocks/blockUsage.ts";
import { ViewFocus } from "../../scene/viewFocus.ts";

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

  @property({ attribute: false })
  declare engine: VoxelEngine | undefined;

  @property({ attribute: false })
  declare state: EditorState;

  @property({ attribute: false })
  declare viewFocus: ViewFocus;

  @state()
  declare _selection: LayerSelection;

  @query("jolly-folder")
  declare _folder: HTMLElementTagNameMap["jolly-folder"] | null;

  @query("layer-manager")
  declare _layerManager: LayerManager | null;

  #subscriptions: Array<() => void> = [];

  get world(): VoxelWorld | undefined {
    return this.engine?.world;
  }

  constructor() {
    super();
    this.engine = undefined;
    this.state = editorState;
    this.viewFocus = new ViewFocus();
    this._selection = null;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#subscriptions.push(
      this.state.selection.watch("change", this.#onSelectionChange),
      this.state.usage.watch("change", this.#onUsageChange)
    );
    this.#onSelectionChange(this.state.selection.current);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  readonly #onUsageChange = (): void => {
    this.requestUpdate();
  };

  readonly #onSelectionChange = (selection: LayerSelection): void => {
    this._selection = selection;
  };

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
      (this.world?.getLayers().length ?? 0) > 1;
  }

  override render() {
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
        >${formatCount(this.state.usage.stats.voxels, "voxel")}</span>
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
          .world=${this.world}
          .selection=${this.state.selection}
          .worldStore=${this.state.world}
          .presence=${this.state.presence}
          .viewFocus=${this.viewFocus}
          style="height:200px;"
        ></layer-manager>
        ${this.#renderSelectionPanel()}
      </jolly-folder>
    `;
  }

  #renderSelectionPanel() {
    const selection = this._selection;
    if (selection === null) {
      return nothing;
    }

    switch (selection.kind) {
      case "voxel-layer":
        return html`<layer-panel
          .world=${this.world}
          .selection=${this.state.selection}
          .worldStore=${this.state.world}
          .layerName=${selection.name}
        ></layer-panel>`;
      case "object":
        return html`<object-panel
          .world=${this.world}
          .worldStore=${this.state.world}
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
