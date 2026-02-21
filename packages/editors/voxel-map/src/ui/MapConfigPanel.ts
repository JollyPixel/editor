// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { VoxelRenderer } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { GridRenderer } from "../components/GridRenderer.ts";
import type { EventInput } from "./types.ts";

@customElement("map-config-panel")
export class MapConfigPanel extends LitElement {
  static override styles = css`
    :host {
      display: block;
      padding: 8px;
      color: #ccc;
      font-size: 13px;
    }
    .section {
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    label {
      min-width: 80px;
      color: #aaa;
    }
    input[type="number"] {
      width: 60px;
      background: #1a2228;
      border: 1px solid #333;
      color: #eee;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 12px;
    }
    input[type="checkbox"] {
      accent-color: #4488ff;
    }
    button {
      background: #2a3a4a;
      border: 1px solid #4488ff;
      color: #4488ff;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.15s;
    }
    button:hover {
      background: #3a5a7a;
    }
    .btn-row {
      display: flex;
      gap: 6px;
      margin-top: 4px;
    }
    input[type="file"] {
      display: none;
    }
  `;

  @property({ attribute: false }) declare vr: VoxelRenderer;
  @property({ attribute: false }) declare gridRenderer: GridRenderer | undefined;

  @state() private declare _gridExtent: number;
  @state() private declare _gridVisible: boolean;

  constructor() {
    super();
    this._gridExtent = 64;
    this._gridVisible = true;
  }

  override render() {
    return html`
      <div class="section">
        <div class="section-title">Grid Settings</div>
        <div class="row">
          <label>Extent</label>
          <input
            type="number"
            .value=${this._gridExtent}
            min="8" max="512"
            @change=${(event: EventInput) => this.#onExtentChange(event)}
          />
        </div>
        <div class="row">
          <label>Visible</label>
          <input
            type="checkbox"
            ?checked=${this._gridVisible}
            @change=${(event: EventInput) => this.#onGridVisibleChange(event)}
          />
        </div>
      </div>

      <div class="section">
        <div class="section-title">Save / Load</div>
        <div class="btn-row">
          <button @click=${this.#onSave}>Save JSON</button>
          <button @click=${this.#onLoad}>Load JSON</button>
        </div>
        <input type="file" id="file-input" accept=".json" @change=${this.#onFileSelected} />
      </div>
    `;
  }

  #onExtentChange(
    event: EventInput
  ): void {
    const val = parseInt(event.target.value, 10);
    if (!Number.isNaN(val) && val > 0) {
      this._gridExtent = val;
      this.gridRenderer?.setExtent(val);
    }
  }

  #onGridVisibleChange(
    event: EventInput
  ): void {
    this._gridVisible = event.target.checked;
    this.gridRenderer?.setVisible(this._gridVisible);
  }

  #onSave(): void {
    if (!this.vr) {
      return;
    }

    const json = this.vr.save();
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
    const input = this.shadowRoot!.querySelector<HTMLInputElement>("#file-input")!;
    input.value = "";
    input.click();
  }

  async #onFileSelected(
    event: EventInput
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || !this.vr) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await this.vr.load(data);

      this.dispatchEvent(
        new CustomEvent("world-loaded", { bubbles: true, composed: true })
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
