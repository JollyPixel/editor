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
import {
  RoomAccess,
  type PixelArtKeyBindingSettings,
  type PixelDrawPanel
} from "@jolly-pixel/editor.pixel-art";
import {
  PixelCollaboration,
  SharedPixelHistory,
  type PixelArtRoom
} from "@jolly-pixel/asset.pixel-art/client";
import "@jolly-pixel/ui";
import { peerProfileColor } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import "./BuildTab.ts";
import "../features/texture/TextureSizeField.ts";
import type { TexturePane } from "./texturePanes.ts";
import type { BuildWorkspace } from "./BuildTab.ts";
import { PeerRegionSelections } from "../features/texture/index.ts";
import type { PresenceStore } from "../state/index.ts";
import type { EditorHistory } from "../features/history/index.ts";
import type { ModelAccessSignals } from "../access/ModelAccess.ts";

// CONSTANTS
const kDefaultZoom = {
  default: 4,
  min: 1,
  max: 32,
  sensitivity: 0.6
};

export interface LeftPanelWorkspace extends BuildWorkspace {
  access: ModelAccessSignals;
  presence: PresenceStore;
  history: EditorHistory;
}

export interface LeftPanelTexture {
  document: PixelDocument;
  room: PixelArtRoom;
}

interface CanvasSources {
  readonly texture: LeftPanelTexture;
  readonly workspace: LeftPanelWorkspace;
}

export class LeftPanel extends LitElement {
  @state()
  declare mode: TexturePane;

  @state()
  private declare _canvas: PixelArtCanvas | null;

  @property({ attribute: false })
  declare workspace: LeftPanelWorkspace | null;

  @property({ attribute: false })
  declare keyBindingSettings: PixelArtKeyBindingSettings | null;

  @query("pixel-draw-panel")
  declare private panelElement: PixelDrawPanel;

  onPeerUvDragging: ((region: UVRegion) => void) | undefined;

  #resizeObserver: ResizeObserver | null = null;
  #texture: LeftPanelTexture | null = null;
  #collaboration: PixelCollaboration | null = null;
  #access: RoomAccess | null = null;
  #releaseModelAccess: (() => void) | null = null;
  #peerRegionSelections: PeerRegionSelections | null = null;
  #initializing = false;
  #initialized: CanvasSources | null = null;
  #releaseKeyBindings: (() => void) | null = null;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
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

  showTexture(
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
    if (this.#initializing || !this.hasUpdated) {
      return;
    }

    this.#initializing = true;
    try {
      for (
        let next = this.#canvasToInitialize();
        next !== null;
        next = this.#canvasToInitialize()
      ) {
        await this.#bindCanvas(next);
      }
    }
    finally {
      this.#initializing = false;
    }
  }

  #canvasToInitialize(): CanvasSources | null {
    const texture = this.#texture;
    const workspace = this.workspace;
    if (
      texture === null ||
      workspace === null ||
      (
        this.#initialized?.texture === texture &&
        this.#initialized.workspace === workspace
      )
    ) {
      return null;
    }

    return {
      texture,
      workspace
    };
  }

  async #bindCanvas(
    sources: CanvasSources
  ): Promise<void> {
    const { texture, workspace } = sources;
    this.#collaboration?.destroy();
    this.#collaboration = null;
    this.#access?.dispose();
    this.#access = null;

    const canvas = await this.panelElement.initialize({
      document: texture.document,
      defaultMode: "move",
      zoom: kDefaultZoom,
      brush: { size: 8 },
      history: new SharedPixelHistory(workspace.history, "build")
    });
    this.#initialized = sources;
    canvas.uv.showAll = true;
    canvas.uv.showRegionLabels = true;
    canvas.uv.labelScope = "selected";
    canvas.mode = canvasModeForTab(this.mode);
    this._canvas = canvas;

    this.#collaboration = new PixelCollaboration({
      room: texture.room,
      canvas,
      color: peerProfileColor,
      onRemoteUvDragging: (region) => this.onPeerUvDragging?.(region)
    });
    const textureId = this.panelElement.activeTextureId;
    if (textureId !== null) {
      this.#access = new RoomAccess(texture.room, this.panelElement, textureId);
    }
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
      this.#releaseModelAccess?.();
      this.#releaseModelAccess = this.workspace?.access.subscribe(
        "change",
        () => this.requestUpdate()
      ) ?? null;
      this.#syncPeerRegionSelections();
      void this.#initializeCanvas();
    }
    if (changedProperties.has("keyBindingSettings")) {
      this.#releaseKeyBindings?.();
      this.#releaseKeyBindings =
        this.keyBindingSettings?.sync(this.panelElement) ?? null;
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
      this.#access?.dispose();
      this.#access = null;
      this.#releaseModelAccess?.();
      this.#releaseModelAccess = null;
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
        .workspace=${this.workspace}
      ></jolly-model-editor-build>
      <jolly-model-editor-texture-size
        ?hidden=${this.mode !== "build"}
        .canvas=${this._canvas}
        .model=${this.workspace?.document ?? null}
      ></jolly-model-editor-texture-size>
      <pixel-draw-panel
        uv-resize
        uv-overflow="64"
        uv-access=${this.workspace?.access.current.has("uv") === false ? "view" : "edit"}
      ></pixel-draw-panel>
    `;
  }
}

function canvasModeForTab(
  mode: TexturePane
): Mode {
  return mode === "build" ? "uv" : "paint";
}

customElements.define("jolly-model-editor-left-panel", LeftPanel);
