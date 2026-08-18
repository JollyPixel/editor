// Import Third-party Dependencies
import { LitElement, css, html, type TemplateResult } from "lit";
import { state, query } from "lit/decorators.js";
import { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import "@jolly-pixel/ui";

// Import Internal Dependencies
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

  private canvasManager: PixelArtCanvas;

  private lastReparentedMode: "paint" | "build" | "animate" | null = null;
  private hasInitializedCenter: boolean = false;
  private hasInitialized: boolean = false;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      font: inherit;
    }

    jolly-tabs {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
    }

    #leftPanelContent {
      display: flex;
      flex-direction: column;
    }
  `;

  constructor() {
    super();
    this.mode = "build";

    // Create a temporary container for the PixelArtCanvas
    const containerDiv = document.createElement("div");

    // Initialize PixelArtCanvas with the temporary container
    this.canvasManager = new PixelArtCanvas(containerDiv, {
      texture: { size: kTextureSize },
      defaultMode: "move",
      zoom: kDefaultZoom,
      brush: {
        size: 8
      }
    });
  }

  public getSharedPixelArtCanvas(): PixelArtCanvas {
    return this.canvasManager;
  }

  public getActiveComponent(): any {
    const selector = (this.mode === "build") ? kBuildComponentSelector : kPaintComponentSelector;

    return this.renderRoot.querySelector(selector);
  }

  private updateCanvasMode(): void {
    const newMode = (this.mode === "paint") ? "paint" : "move";
    this.canvasManager.mode = newMode;
  }

  private handleTabChange = (
    event: CustomEvent<{ value: string; }>
  ): void => {
    this.mode = event.detail.value as "paint" | "build" | "animate";
  };

  private syncTextureSizeInputs(): void {
    const textureSize = this.canvasManager.textureSize;

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

    // Synchronize texture size inputs with PixelArtCanvas state
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

  override render(): TemplateResult {
    return html`
      <div id="leftPanelContent">
        <jolly-tabs .value=${this.mode} @jolly-tab-change=${this.handleTabChange}>
          <jolly-tab value="build" label="Build">
            <jolly-model-editor-build></jolly-model-editor-build>
          </jolly-tab>
          <jolly-tab value="paint" label="Paint">
            <jolly-model-editor-paint></jolly-model-editor-paint>
          </jolly-tab>
          <jolly-tab value="animate" label="Animate" disabled></jolly-tab>
        </jolly-tabs>
      </div>
    `;
  }
}

customElements.define("jolly-model-editor-left-panel", LeftPanel);
