// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import { state, query } from "lit/decorators.js";
import {
  type Mode,
  type PixelArtCanvas,
  type PixelArtCanvasOptions
} from "@jolly-pixel/pixel-draw.renderer";
import { type PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";
import "@jolly-pixel/ui";

// Import Internal Dependencies
import "./tabs/Build.ts";

// CONSTANTS
const kTextureSize = { x: 64, y: 64 };
const kDefaultZoom = {
  default: 4,
  min: 1,
  max: 32,
  sensitivity: 0.1
};

type LeftPanelMode = "paint" | "build" | "animate";

export class LeftPanel extends LitElement {
  @state()
  declare mode: LeftPanelMode;

  @query("pixel-draw-panel")
  declare private panelElement: PixelDrawPanel;

  #canvasManager: PixelArtCanvas | null = null;
  #resizeObserver: ResizeObserver | null = null;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      font: inherit;
    }

    jolly-tabs {
      flex-shrink: 0;
    }

    jolly-tabs::part(list) {
      display: flex;
    }

    jolly-tabs::part(tab) {
      flex: 1 1 0;
      text-align: center;
    }

    pixel-draw-panel {
      flex: 1;
      min-height: 200px;
    }
  `;

  constructor() {
    super();
    this.mode = "build";
  }

  get canvasManager(): PixelArtCanvas | null {
    return this.#canvasManager;
  }

  public onResize(): void {
    this.panelElement?.onResize();
  }

  override async firstUpdated(): Promise<void> {
    const options: PixelArtCanvasOptions = {
      texture: { size: kTextureSize },
      defaultMode: "move",
      zoom: kDefaultZoom,
      brush: { size: 8 }
    };

    this.#canvasManager = await this.panelElement.initialize(options);
    this.#canvasManager.uv.showAll = true;
    this.#canvasManager.mode = this.#canvasModeForTab(this.mode);

    this.#resizeObserver = new ResizeObserver(() => this.panelElement.onResize());
    this.#resizeObserver.observe(this.panelElement);
  }

  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("mode") && this.#canvasManager) {
      this.#canvasManager.mode = this.#canvasModeForTab(this.mode);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
  }

  #canvasModeForTab(
    mode: LeftPanelMode
  ): Mode {
    return mode === "build" ? "uv" : "paint";
  }

  private handleTabChange = (
    event: CustomEvent<{ value: string; }>
  ): void => {
    this.mode = event.detail.value as LeftPanelMode;
  };

  override render(): TemplateResult {
    return html`
      <jolly-tabs .value=${this.mode} @jolly-tab-change=${this.handleTabChange}>
        <jolly-tab value="build" label="Build"></jolly-tab>
        <jolly-tab value="paint" label="Paint"></jolly-tab>
        <jolly-tab value="animate" label="Animate" disabled></jolly-tab>
      </jolly-tabs>
      <jolly-model-editor-build ?hidden=${this.mode !== "build"}></jolly-model-editor-build>
      <pixel-draw-panel></pixel-draw-panel>
    `;
  }
}

customElements.define("jolly-model-editor-left-panel", LeftPanel);
