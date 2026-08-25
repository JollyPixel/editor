// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import {
  showPrompt,
  type JollySelectDetail,
  type JollyToggleVisibleDetail,
  type TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";

// CONSTANTS
const kVoxelPrefix = "voxel:";
const kObjectPrefix = "object:";

/** A layer kind and name packed into a unique tree row ID. */
interface LayerRef {
  type: "voxel" | "object";
  name: string;
}

function refOf(
  id: string
): LayerRef {
  return id.startsWith(kObjectPrefix)
    ? { type: "object", name: id.slice(kObjectPrefix.length) }
    : { type: "voxel", name: id.slice(kVoxelPrefix.length) };
}

@customElement("layer-manager")
export class LayerManager extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      overflow: hidden;
    }

    .tree-host {
      flex: 1;
      overflow-y: auto;
    }
  `;

  @property({ attribute: false })
  declare vr: VoxelRenderer;

  @state()
  private declare _nodes: TreeNode<LayerRef>[];
  @state()
  private declare _selected: string[];
  #subscriptions: Array<() => void> = [];

  constructor() {
    super();
    this._nodes = [];
    this._selected = [];
  }

  readonly #onLayerUpdated = () => {
    this.#refreshNodes();
  };

  readonly #onSelectedLayerChange = () => {
    this._selected = this.#selectionFromState();
  };

  override updated(
    changedProperties: Map<string | symbol, unknown>
  ): void {
    if (changedProperties.has("vr") && this.vr) {
      this.#refreshNodes();
    }
  }

  override connectedCallback() {
    super.connectedCallback();

    this.#subscriptions.push(
      editorState.on("layerUpdated", this.#onLayerUpdated),
      editorState.on("worldReset", this.#onLayerUpdated),
      editorState.on("selectionChange", this.#onSelectedLayerChange)
    );

    this._selected = this.#selectionFromState();
    this.#refreshNodes();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }

  override render() {
    const hasSelection = this._selected.length > 0;

    return html`
      <jolly-toolbar label="Layers">
        <jolly-button @click=${this.#addLayer}>+ Voxel</jolly-button>
        <jolly-button @click=${this.#addObjectLayer}>+ Object</jolly-button>
        <jolly-button
          @click=${this.#removeLayer}
          ?disabled=${!hasSelection}
        >- Remove</jolly-button>
        <jolly-button
          @click=${this.#moveUp}
          ?disabled=${!hasSelection}
        >↑</jolly-button>
        <jolly-button
          @click=${this.#moveDown}
          ?disabled=${!hasSelection}
        >↓</jolly-button>
      </jolly-toolbar>

      <div class="tree-host" @click=${this.#onHostClick}>
        <jolly-tree
          .nodes=${this._nodes}
          .selected=${this._selected}
          @jolly-select=${this.#onSelect}
          @jolly-toggle-visible=${this.#onToggleVisible}
        ></jolly-tree>
      </div>
    `;
  }

  get #selectedRef(): LayerRef | null {
    const [id] = this._selected;

    return id === undefined ? null : refOf(id);
  }

  #selectionFromState(): string[] {
    const {
      selectedLayer,
      selectedLayerType
    } = editorState;
    if (selectedLayer === null) {
      return [];
    }

    const prefix = selectedLayerType === "object" ? kObjectPrefix : kVoxelPrefix;

    return [`${prefix}${selectedLayer}`];
  }

  #refreshNodes(): void {
    if (!this.vr) {
      return;
    }

    const layers = [
      ...this.vr.engine.world.getLayers()
    ].reverse();

    this._nodes = [
      ...layers.map((layer): TreeNode<LayerRef> => {
        return {
          id: `${kVoxelPrefix}${layer.name}`,
          label: layer.name,
          visible: layer.visible,
          data: { type: "voxel", name: layer.name }
        };
      }),
      ...this.vr.engine.getObjectLayers().map((layer): TreeNode<LayerRef> => {
        return {
          id: `${kObjectPrefix}${layer.name}`,
          label: `[Obj] ${layer.name}`,
          visible: layer.visible,
          data: { type: "object", name: layer.name }
        };
      })
    ];
  }

  #onHostClick(
    event: MouseEvent
  ): void {
    const onRow = event.composedPath().some(
      (node) => node instanceof HTMLElement && node.classList.contains("row")
    );
    if (onRow) {
      return;
    }

    this._selected = [];
    editorState.setSelectedLayer(null);
  }

  #onSelect(
    event: CustomEvent<JollySelectDetail>
  ): void {
    this._selected = event.detail.selected;

    const ref = this.#selectedRef;
    if (ref === null) {
      editorState.setSelectedLayer(null);

      return;
    }
    editorState.setSelectedLayer(ref.name, ref.type);
  }

  #onToggleVisible(
    event: CustomEvent<JollyToggleVisibleDetail>
  ): void {
    if (!this.vr) {
      return;
    }

    const { visible } = event.detail;
    const { type, name } = refOf(event.detail.id);
    if (type === "object") {
      this.vr.engine.updateObjectLayer(name, { visible });
    }
    else {
      this.vr.engine.updateLayer(name, { visible });
      this.vr.engine.markAllChunksDirty();
    }
    this.#refreshNodes();
  }

  async #addLayer() {
    if (!this.vr) {
      return;
    }

    const name = await showPrompt({
      title: "New layer",
      label: "Layer name:",
      defaultValue: `Layer ${this.vr.engine.world.getLayers().length + 1}`
    });
    if (!name?.trim()) {
      return;
    }
    this.vr.engine.addLayer(name.trim());
  }

  async #addObjectLayer() {
    if (!this.vr) {
      return;
    }

    const name = await showPrompt({
      title: "New object layer",
      label: "Object layer name:",
      defaultValue: `Objects ${this.vr.engine.getObjectLayers().length + 1}`
    });
    if (!name?.trim()) {
      return;
    }
    this.vr.engine.addObjectLayer(name.trim());
  }

  #removeLayer(): void {
    const ref = this.#selectedRef;
    if (ref === null || !this.vr) {
      return;
    }

    if (ref.type === "object") {
      this.vr.engine.removeObjectLayer(ref.name);
    }
    else {
      this.vr.engine.removeLayer(ref.name);
      this.vr.engine.markAllChunksDirty();
    }
    this._selected = [];
    editorState.setSelectedLayer(null);
  }

  #moveUp(): void {
    this.#move("up");
  }

  #moveDown(): void {
    this.#move("down");
  }

  #move(
    direction: "up" | "down"
  ): void {
    const ref = this.#selectedRef;
    if (
      ref === null ||
      ref.type === "object" ||
      !this.vr
    ) {
      return;
    }

    this.vr.engine.moveLayer(ref.name, direction);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-manager": LayerManager;
  }
}
