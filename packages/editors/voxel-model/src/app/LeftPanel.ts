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
import type * as network from "@jolly-pixel/network";
import {
  PixelCollaboration,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  peerColor,
  readUsername
} from "../collaboration/identity.ts";
import "./tabs/Build.ts";

// CONSTANTS
const kTextureSize = { x: 64, y: 64 };
const kDefaultZoom = {
  default: 4,
  min: 1,
  max: 32,
  sensitivity: 0.6
};

type LeftPanelMode = "paint" | "build" | "animate";

export class LeftPanel extends LitElement {
  @state()
  declare mode: LeftPanelMode;

  @query("pixel-draw-panel")
  declare private panelElement: PixelDrawPanel;

  #canvasManager: PixelArtCanvas | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #textureRoom: network.Room<PixelNetworkCommand, PixelServerMessage> | undefined;
  #collaboration: PixelCollaboration | null = null;

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

  public setTextureRoom(
    room: network.Room<PixelNetworkCommand, PixelServerMessage>
  ): void {
    this.#textureRoom = room;
    this.#tryAttachCollaboration();
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
    this.#canvasManager.uv.showRegionLabels = true;
    this.#canvasManager.mode = this.#canvasModeForTab(this.mode);
    this.#tryAttachCollaboration();

    this.#resizeObserver = new ResizeObserver(() => this.panelElement.onResize());
    this.#resizeObserver.observe(this.panelElement);
  }

  #tryAttachCollaboration(): void {
    if (this.#canvasManager && this.#textureRoom) {
      this.#destroyCollaboration();
      this.#collaboration = new PixelCollaboration({
        room: this.#textureRoom,
        canvas: this.#canvasManager,
        label: (_clientId, profile) => readUsername(profile),
        color: peerColor
      });
      this.#textureRoom.join();
    }
  }

  #destroyCollaboration(): void {
    this.#collaboration?.destroy();
    this.#collaboration = null;
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
    this.#destroyCollaboration();
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
