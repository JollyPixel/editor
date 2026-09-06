// Import Third-party Dependencies
import {
  LitElement,
  html,
  css,
  type PropertyValues
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import type {
  VoxelEngine,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import type { JollyChangeDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { GridRenderer } from "../../scene/GridRenderer.ts";
import { parseVoxelWorld } from "./parseVoxelWorld.ts";
import type { EventInput } from "../../shared/domEvents.ts";

@customElement("map-config-panel")
export class MapConfigPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }

    input[type="file"] {
      display: none;
    }

    .actions {
      display: flex;
      gap: var(--jolly-row-gap, 4px);
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine | undefined;

  @property({ attribute: false })
  declare gridRenderer: GridRenderer | undefined;

  @property({ attribute: false })
  declare onLoadWorld: ((data: VoxelWorldJSON) => void) | undefined;

  @state()
  private declare _gridVisible: boolean;

  @query("#file-input")
  declare private _fileInput: HTMLInputElement;

  constructor() {
    super();
    this.engine = undefined;
    this._gridVisible = true;
  }

  override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (
      changedProperties.has("gridRenderer") &&
      this.gridRenderer
    ) {
      this._gridVisible = this.gridRenderer.visible;
    }
  }

  override render() {
    return html`
      <jolly-checkbox
        align="end"
        label="Grid visibility"
        .value=${this._gridVisible}
        @jolly-change=${this.#onGridVisibleChange}
      ></jolly-checkbox>

      <div class="actions">
        <jolly-button @click=${this.#onSave}>Save JSON</jolly-button>
        <jolly-button variant="danger" @click=${this.#onLoad}>Load JSON</jolly-button>
      </div>
      <input type="file" id="file-input" accept=".json" @change=${this.#onFileSelected} />
    `;
  }

  #onGridVisibleChange(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this._gridVisible = event.detail.value;
    this.gridRenderer?.setVisible(this._gridVisible);
  }

  #onSave(): void {
    if (!this.engine) {
      return;
    }

    const json = this.engine.save();
    const blob = new Blob([JSON.stringify(json, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "map.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  #onLoad(): void {
    const input = this._fileInput;
    input.value = "";
    input.click();
  }

  async #onFileSelected(
    event: EventInput
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const data = parseVoxelWorld(text);
      this.onLoadWorld?.(data);

      this.dispatchEvent(
        new CustomEvent("world-loaded", {
          bubbles: true,
          composed: true
        })
      );
    }
    catch (err) {
      console.error("Failed to load map:", err);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "map-config-panel": MapConfigPanel;
  }
}
