// Import Third-party Dependencies
import { LitElement, css, html } from "lit";
import { query, state } from "lit/decorators.js";

// Import Internal Dependencies
import CanvasManager from "../../CanvasManager.js";

export class Paint extends LitElement {
  @query("#texturePreview")
  declare texturePreviewElement: HTMLDivElement;

  @query("#colorPicker")
  declare colorPickerElement: HTMLInputElement;

  @query("#brushSize")
  declare brushSizeElement: HTMLInputElement;

  @state()
  declare brushColor: string;

  @state()
  declare brushSize: number;

  @state()
  declare brushOpacity: number;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      padding: 0;
      box-sizing: border-box;
      gap: 15px;
    }

    .input-row {
      display: flex;
      flex-direction: row;
      gap: 10px;
      align-items: center;
      padding: 0 5px;
    }

    .input-row > label {
      font-weight: bold;
      font-size: 0.9em;
      flex-grow: 1;
      text-align: right;
    }

    .input-row > input[type="color"] {
      width: 30px;
      height: 30px;
      border: 2px solid #AAA;
      border-radius: 5px;
      cursor: pointer;
    }

    .input-row >input[type="range"] {
      width: 150px;
      cursor: pointer;
    }

    .input-row >input[type="number"] {
      width: 30px;
      cursor: pointer;
    }

    .input-row > .brushSizeDisplay {
      font-size: 0.85em;
      color: black;
      width: 30px;
      text-align: center;
      font-weight bold;
    }

    #texturePreview {
      position: relative;
      flex: 1;
      width: 100%;
      min-height: 200px;
      background: #AAA;
      box-sizing: border-box;
    }
  `;

  constructor() {
    super();
    this.brushColor = "#000000";
    this.brushSize = 16;
    this.brushOpacity = 1;
  }

  private getLeftPanel(): any {
    const rootNode = this.getRootNode() as ShadowRoot;

    return rootNode?.host;
  }

  private getCanvasManager(): CanvasManager | null {
    const leftPanel = this.getLeftPanel();

    if (!leftPanel || typeof leftPanel.getSharedCanvasManager !== "function") {
      return null;
    }

    return leftPanel.getSharedCanvasManager();
  }

  public syncBrushInputs(): void {
    const manager = this.getCanvasManager();

    if (!manager) {
      return;
    }

    this.brushSize = manager.brush.getSize();
    this.brushColor = manager.brush.getColor();
    this.brushOpacity = manager.brush.getOpacity();
  }

  protected override firstUpdated(): void {
    this.syncBrushInputs();
    this.setupColorPickListener();
  }

  private setupColorPickListener(): void {
    const manager = this.getCanvasManager();

    if (!manager) {
      return;
    }

    const canvas = manager.getParentHtmlElement().querySelector("canvas");
    if (!canvas) {
      return;
    }

    canvas.addEventListener("colorpicked", ((event: CustomEvent) => {
      const { hex, opacity } = event.detail;
      this.brushColor = hex;
      this.brushOpacity = opacity;
      this.requestUpdate();
    }) as EventListener);
  }

  override updated(): void {
    const manager = this.getCanvasManager();

    if (!manager) {
      console.warn("Paint: No canvas manager available");

      return;
    }

    if (!this.texturePreviewElement) {
      console.error("Paint: texturePreview element not found");

      return;
    }

    const rect = this.texturePreviewElement.getBoundingClientRect();

    if ((rect.width > 0) && (rect.height > 0)) {
      manager.reparentCanvasTo(this.texturePreviewElement);
    }
  }

  private handleColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.brushColor = input.value;

    const manager = this.getCanvasManager();

    if (manager) {
      manager.brush.setColor(this.brushColor);
    }
  }

  private handleBrushSizeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.brushSize = parseInt(input.value, 10);

    const manager = this.getCanvasManager();

    if (manager) {
      manager.brush.setSize(this.brushSize);
    }
  }

  private handleOpacityChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.brushOpacity = parseFloat(input.value);

    const manager = this.getCanvasManager();

    if (manager) {
      manager.brush.setOpacity(this.brushOpacity);
    }
  }

  public setCanvasTexture(canvas: HTMLCanvasElement): void {
    const manager = this.getCanvasManager();

    if (manager) {
      manager.setTexture(canvas);
    }
  }

  override render() {
    return html`
      <div class="input-row">
        <label>Color</label>
        <input
          type="color"
          id="colorPicker"
          .value="${this.brushColor}"
          @change="${this.handleColorChange}">
      </div>
      <div class="input-row">
        <label>Opacity</label>
        <input
          type="range"
          id="opacity"
          name="opacity"
          min="0"
          max="1"
          step="0.01"
          .value="${this.brushOpacity.toString()}"
          @input="${this.handleOpacityChange}">
        <span class="opacityDisplay">${Math.round(this.brushOpacity * 100)}%</span>
      </div>
      <div class="input-row">
        <label>Size</label>
        <input
          type="range"
          id="brushSize"
          name="brushSize"
          min="1"
          max="32"
          .value="${this.brushSize.toString()}"
          @input="${this.handleBrushSizeChange}">
        <span class="brushSizeDisplay">${this.brushSize}px</span>
      </div>

      <div id="texturePreview"></div>
    `;
  }
}

customElements.define("jolly-model-editor-paint", Paint);
