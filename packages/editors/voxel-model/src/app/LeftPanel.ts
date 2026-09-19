// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import { state, query } from "lit/decorators.js";
import type {
  Mode,
  PixelArtCanvas,
  PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";
import { type PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";
import {
  PixelCollaboration,
  type PixelArtRoom,
  type UVGhostPayload
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import "@jolly-pixel/ui";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import "./tabs/Build.ts";

// CONSTANTS
const kDefaultZoom = {
  default: 4,
  min: 1,
  max: 32,
  sensitivity: 0.6
};

type LeftPanelMode = "paint" | "build" | "animate";

export interface LeftPanelTexture {
  document: PixelDocument;
  room?: PixelArtRoom;
}

export class LeftPanel extends LitElement {
  @state()
  declare mode: LeftPanelMode;

  @query("pixel-draw-panel")
  declare private panelElement: PixelDrawPanel;

  #canvasManager: PixelArtCanvas | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #texture: LeftPanelTexture | null = null;
  #collaboration: PixelCollaboration | null = null;
  #onRemoteUvDragging: ((payload: UVGhostPayload) => void) | undefined;
  #ready = Promise.withResolvers<PixelArtCanvas>();

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

  get canvasReady(): Promise<PixelArtCanvas> {
    return this.#ready.promise;
  }

  public onResize(): void {
    this.panelElement?.onResize();
  }

  public setTexture(
    texture: LeftPanelTexture
  ): void {
    this.#texture = texture;
    void this.#initializeCanvas();
  }

  public setPeerUvDraggingHandler(
    handler: (payload: UVGhostPayload) => void
  ): void {
    this.#onRemoteUvDragging = handler;
  }

  override firstUpdated(): void {
    this.#resizeObserver = new ResizeObserver(() => this.panelElement.onResize());
    this.#resizeObserver.observe(this.panelElement);
    void this.#initializeCanvas();
  }

  async #initializeCanvas(): Promise<void> {
    const texture = this.#texture;
    if (texture === null || !this.hasUpdated || this.#canvasManager !== null) {
      return;
    }

    const canvas = await this.panelElement.initialize({
      document: texture.document,
      defaultMode: "move",
      zoom: kDefaultZoom,
      brush: { size: 8 }
    });
    canvas.uv.showAll = true;
    canvas.uv.showRegionLabels = true;
    canvas.mode = this.#canvasModeForTab(this.mode);
    this.#canvasManager = canvas;

    if (texture.room !== undefined) {
      this.#collaboration = new PixelCollaboration({
        room: texture.room,
        canvas,
        label: (_clientId, profile) => readUsername(profile),
        color: peerProfileColor,
        onRemoteUvDragging: (payload) => this.#onRemoteUvDragging?.(payload)
      });
    }
    this.#ready.resolve(canvas);
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
    this.#collaboration?.destroy();
    this.#collaboration = null;
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
