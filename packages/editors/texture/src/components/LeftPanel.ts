// Import Third-party Dependencies
import { LitElement, css, html } from "lit";
import { state, query } from "lit/decorators.js";

// Import Internal Dependencies
import CanvasManager from "../texture/CanvasManager.ts";
import "./tabs/Paint.ts";
import "./tabs/Build.ts";

// CONSTANTS
const kBuildComponentSelector = "jolly-model-editor-build";
const kPaintComponentSelector = "jolly-model-editor-paint";
const kTextureSize = { x: 64, y: 64 };
const kDefaultZoom = {
  default: 4,
  min: 1,
  max: 32,
  sensitivity: 0.1
};

export class LeftPanel extends LitElement {
  @state()
  declare mode: "paint" | "build" | "animate";

  @query(kBuildComponentSelector)
  declare buildComponent: any;

  @query(kPaintComponentSelector)
  declare paintComponent: any;

  private canvasManager: CanvasManager;

  private lastReparentedMode: "paint" | "build" | "animate" | null = null;
  private hasInitializedCenter: boolean = false;
  private hasInitialized: boolean = false;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-width: 300px;
      width: 300px;
      height: 100%;
      background: green;
      flex-shrink: 0;
    }

    ul {
      height: 40px;
      width: 100%;
      margin: 0;
      margin-bottom: 5px;
      padding: 0;
      display: flex;

      box-sizing: border-box;
      border: 2px solid #222;
      border-radius: 5px;

      list-style: none;
    }

    ul > li {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: #AAA;
      border: 2px solid #CCC;
      font-weight: normal;
    }

    ul > li:hover {
      color: #fff;
      cursor: pointer;
      background: #444;
    }

    ul > li.mode-active {
      background: #222;
      color: #fff;
      font-weight: bold;
    }

    #leftPanelContent {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: auto;
    }
  `;

  constructor() {
    super();
    this.mode = "build";

    // Create a temporary container for the CanvasManager
    const containerDiv = document.createElement("div");

    // Initialize CanvasManager with the temporary container
    this.canvasManager = new CanvasManager(containerDiv, {
      texture: { size: kTextureSize },
      defaultMode: "move",
      zoom: kDefaultZoom,
      brush: {
        size: 8
      }
    });
  }

  public getSharedCanvasManager(): CanvasManager {
    return this.canvasManager;
  }

  public getActiveComponent(): any {
    const selector = (this.mode === "build") ? kBuildComponentSelector : kPaintComponentSelector;

    return this.renderRoot.querySelector(selector);
  }

  private updateCanvasMode(): void {
    const newMode = (this.mode === "paint") ? "paint" : "move";
    this.canvasManager.setMode(newMode);
  }

  private handleTabClick(tabMode: "paint" | "build" | "animate"): void {
    this.mode = tabMode;
  }

  private syncTextureSizeInputs(): void {
    const textureSize = this.canvasManager.getTextureSize();

    if (!this.buildComponent) {
      return;
    }

    const textureSizeXInput = this.buildComponent.renderRoot.querySelector("#textureSizeX") as HTMLSelectElement;
    const textureSizeYInput = this.buildComponent.renderRoot.querySelector("#textureSizeY") as HTMLSelectElement;

    if (textureSizeXInput) {
      textureSizeXInput.value = String(textureSize.x);
    }

    if (textureSizeYInput) {
      textureSizeYInput.value = String(textureSize.y);
    }
  }

  private async initializeReparenting(): Promise<void> {
    if (!this.buildComponent || !this.paintComponent) {
      throw new Error("LeftPanel: Build or Paint component not found");
    }

    // Wait for both components to be fully updated
    await Promise.all([this.buildComponent.updateComplete, this.paintComponent.updateComplete]);

    if (!this.buildComponent.texturePreviewElement || !this.paintComponent.texturePreviewElement) {
      throw new Error("LeftPanel: texturePreviewElement not found on Build or Paint component");
    }

    // Reparent to the active component and center texture
    this.reparentCanvasToActiveTab();

    // Synchronize texture size inputs with CanvasManager state
    this.syncTextureSizeInputs();

    this.hasInitialized = true;
  }

  private reparentCanvasToActiveTab(): void {
    const activeComponent = this.getActiveComponent();

    // Only reparent if we have a valid active component with preview element
    if (!activeComponent?.texturePreviewElement) {
      return;
    }

    if (this.lastReparentedMode !== this.mode) {
      this.canvasManager.reparentCanvasTo(activeComponent.texturePreviewElement);

      if (!this.hasInitializedCenter) {
        this.canvasManager.centerTexture();
        this.hasInitializedCenter = true;
      }

      this.lastReparentedMode = this.mode;
    }
  }

  override async firstUpdated(): Promise<void> {
    try {
      await this.initializeReparenting();
    }
    catch (error) {
      console.error(error);
    }
  }

  override updated(): void {
    if (!this.hasInitialized) {
      return;
    }

    try {
      this.updateCanvasMode();
      this.reparentCanvasToActiveTab();
      this.canvasManager.onResize();
    }
    catch (error) {
      console.error(error);
    }
  }

  override render() {
    return html`
      <ul>
        <li
          @click="${() => this.handleTabClick("build")}"
          class="${this.mode === "build" ? "mode-active" : ""}"
        >
          Build
        </li>
        <li
          @click="${() => this.handleTabClick("paint")}"
          class="${this.mode === "paint" ? "mode-active" : ""}"
        >
          Paint
        </li>
        <li
          @click="${() => this.handleTabClick("animate")}"
          class="${this.mode === "animate" ? "mode-active" : ""}"
        >
          Animate
        </li>
      </ul>
      <div id="leftPanelContent">
        <jolly-model-editor-build
          style="display: ${this.mode === "build" ? "flex" : "none"};"
        ></jolly-model-editor-build>
        <jolly-model-editor-paint
          style="display: ${this.mode === "paint" ? "flex" : "none"};"
        ></jolly-model-editor-paint>
      </div>
    `;
  }
}

customElements.define("jolly-model-editor-left-panel", LeftPanel);
