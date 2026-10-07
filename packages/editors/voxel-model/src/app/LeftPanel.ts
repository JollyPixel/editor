// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  property,
  query,
  state
} from "lit/decorators.js";
import type {
  Mode,
  PixelArtCanvas,
  PixelDocument,
  UVRegion
} from "@jolly-pixel/pixel-draw.renderer";
import type {
  KeyBindingSettings,
  PixelDrawPanel
} from "@jolly-pixel/editor.pixel-art";
import {
  PixelCollaboration,
  type PixelArtRoom
} from "@jolly-pixel/asset.pixel-art/client";
import "@jolly-pixel/ui";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import "./BuildTab.ts";
import type { TexturePane } from "./texturePanes.ts";
import type { TransformWorkspace } from "../features/transform/TransformPanelController.ts";
import { PeerRegionSelections } from "../features/texture/index.ts";
import type { PresenceStore } from "../state/index.ts";

// CONSTANTS
const kDefaultZoom = {
  default: 4,
  min: 1,
  max: 32,
  sensitivity: 0.6
};

export interface LeftPanelWorkspace extends TransformWorkspace {
  presence: PresenceStore;
}

export interface LeftPanelTexture {
  document: PixelDocument;
  room: PixelArtRoom;
}

export class LeftPanel extends LitElement {
  @state()
  declare mode: TexturePane;

  @state()
  private declare _canvas: PixelArtCanvas | null;

  @property({ attribute: false })
  declare workspace: LeftPanelWorkspace | null;

  @property({ attribute: false })
  declare keyBindingSettings: KeyBindingSettings | null;

  @query("pixel-draw-panel")
  declare private panelElement: PixelDrawPanel;

  onPeerUvDragging: ((region: UVRegion) => void) | undefined;

  #resizeObserver: ResizeObserver | null = null;
  #texture: LeftPanelTexture | null = null;
  #collaboration: PixelCollaboration | null = null;
  #peerRegionSelections: PeerRegionSelections | null = null;
  #initializing = false;
  #releaseKeyBindings: (() => void) | null = null;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      font: inherit;
    }

    pixel-draw-panel {
      flex: 1;
      min-height: 200px;
    }
  `;

  constructor() {
    super();
    this.mode = "build";
    this._canvas = null;
    this.workspace = null;
    this.keyBindingSettings = null;
  }

  setTexture(
    texture: LeftPanelTexture
  ): void {
    this.#texture = texture;
    void this.#initializeCanvas();
  }

  override firstUpdated(): void {
    this.#resizeObserver = new ResizeObserver(
      () => this.panelElement.onResize()
    );
    this.#resizeObserver.observe(this.panelElement);
    void this.#initializeCanvas();
  }

  async #initializeCanvas(): Promise<void> {
    const texture = this.#texture;
    if (
      texture === null ||
      !this.hasUpdated ||
      this.#initializing
    ) {
      return;
    }
    this.#initializing = true;

    const canvas = await this.panelElement.initialize({
      document: texture.document,
      defaultMode: "move",
      zoom: kDefaultZoom,
      brush: { size: 8 }
    });
    canvas.uv.showAll = true;
    canvas.uv.showRegionLabels = true;
    canvas.uv.labelScope = "selected";
    canvas.mode = canvasModeForTab(this.mode);
    this._canvas = canvas;

    this.#collaboration = new PixelCollaboration({
      room: texture.room,
      canvas,
      label: (_clientId, profile) => readUsername(profile),
      color: peerProfileColor,
      onRemoteUvDragging: (region) => this.onPeerUvDragging?.(region)
    });
    this.#syncPeerRegionSelections();
  }

  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    if (
      changedProperties.has("mode") &&
      this._canvas
    ) {
      this._canvas.mode = canvasModeForTab(this.mode);
    }
    if (changedProperties.has("workspace")) {
      this.#syncPeerRegionSelections();
    }
    if (changedProperties.has("keyBindingSettings")) {
      this.#releaseKeyBindings?.();
      this.#releaseKeyBindings =
        this.keyBindingSettings?.bind(this.panelElement) ?? null;
    }
  }

  #syncPeerRegionSelections(): void {
    this.#peerRegionSelections?.dispose();
    this.#peerRegionSelections = this._canvas && this.workspace ?
      new PeerRegionSelections({
        presence: this.workspace.presence,
        target: this._canvas.peerPresence.uvSelections
      }) :
      null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected) {
        return;
      }

      this.#resizeObserver?.disconnect();
      this.#resizeObserver = null;
      this.#collaboration?.destroy();
      this.#collaboration = null;
      this.#peerRegionSelections?.dispose();
      this.#peerRegionSelections = null;
      this.#releaseKeyBindings?.();
      this.#releaseKeyBindings = null;
    });
  }

  override render(): TemplateResult {
    return html`
      <jolly-model-editor-build
        ?hidden=${this.mode !== "build"}
        .canvas=${this._canvas}
        .workspace=${this.workspace}
      ></jolly-model-editor-build>
      <pixel-draw-panel uv-resize></pixel-draw-panel>
    `;
  }
}

function canvasModeForTab(
  mode: TexturePane
): Mode {
  return mode === "build" ? "uv" : "paint";
}

customElements.define("jolly-model-editor-left-panel", LeftPanel);
