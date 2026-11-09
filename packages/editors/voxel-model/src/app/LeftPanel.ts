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
  PixelArtCanvas,
  PixelDocument,
  UVRegion
} from "@jolly-pixel/pixel-draw.renderer";
import {
  TextureRoom,
  type PixelArtAction,
  type PixelDrawPanel,
  type UvNetLibrary
} from "@jolly-pixel/editor.pixel-art";
import {
  SharedPixelHistory,
  type PixelArtRoom
} from "@jolly-pixel/asset.pixel-art/client";
import type { KeyBindingSettings } from "@jolly-pixel/controls";

// Import Internal Dependencies
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

export interface LeftPanelEditing {
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
  readonly editing: LeftPanelEditing;
}

export class LeftPanel extends LitElement {
  @state()
  private declare _canvas: PixelArtCanvas | null;

  @property({ attribute: false })
  declare editing: LeftPanelEditing | null;

  @property({ attribute: false })
  declare keyBindingSettings: KeyBindingSettings<PixelArtAction> | null;

  @property({ attribute: false })
  declare uvNets: UvNetLibrary | null;

  @query("pixel-draw-panel")
  declare private panelElement: PixelDrawPanel;

  onPeerUvDragging: ((region: UVRegion) => void) | undefined;

  #resizeObserver: ResizeObserver | null = null;
  #texture: LeftPanelTexture | null = null;
  #room: TextureRoom | null = null;
  #releaseModelAccess: (() => void) | null = null;
  #peerRegionSelections: PeerRegionSelections | null = null;
  #initializing = false;
  #initialized: CanvasSources | null = null;

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
    this._canvas = null;
    this.editing = null;
    this.keyBindingSettings = null;
    this.uvNets = null;
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
    const editing = this.editing;
    if (
      texture === null ||
      editing === null ||
      (
        this.#initialized?.texture === texture &&
        this.#initialized.editing === editing
      )
    ) {
      return null;
    }

    return {
      texture,
      editing
    };
  }

  async #bindCanvas(
    sources: CanvasSources
  ): Promise<void> {
    const { texture, editing } = sources;
    this.#room?.dispose();
    this.#room = null;

    const canvas = await this.panelElement.initialize({
      document: texture.document,
      defaultMode: "uv",
      zoom: kDefaultZoom,
      brush: { size: 8 },
      history: new SharedPixelHistory(editing.history, "texture")
    });
    this.#initialized = sources;
    canvas.uv.showAll = true;
    canvas.uv.showRegionLabels = true;
    canvas.uv.labelScope = "selected";
    this._canvas = canvas;

    const textureId = this.panelElement.activeTextureId;
    if (textureId !== null) {
      this.#room = new TextureRoom({
        room: texture.room,
        canvas,
        panel: this.panelElement,
        textureId,
        onRemoteUvDragging: (region) => this.onPeerUvDragging?.(region)
      });
    }
    this.#syncPeerRegionSelections();
  }

  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("editing")) {
      this.#releaseModelAccess?.();
      this.#releaseModelAccess = this.editing?.access.subscribe(
        "change",
        () => this.requestUpdate()
      ) ?? null;
      this.#syncPeerRegionSelections();
      void this.#initializeCanvas();
    }
    if (
      changedProperties.has("keyBindingSettings") &&
      this.keyBindingSettings !== null
    ) {
      this.panelElement.keyBindings = this.keyBindingSettings;
    }
    if (changedProperties.has("uvNets") && this.uvNets !== null) {
      this.panelElement.uvNets = this.uvNets;
    }
  }

  #syncPeerRegionSelections(): void {
    this.#peerRegionSelections?.dispose();
    this.#peerRegionSelections = this._canvas && this.editing ?
      new PeerRegionSelections({
        presence: this.editing.presence,
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
      this.#room?.dispose();
      this.#room = null;
      this.#releaseModelAccess?.();
      this.#releaseModelAccess = null;
      this.#peerRegionSelections?.dispose();
      this.#peerRegionSelections = null;
    });
  }

  override render(): TemplateResult {
    return html`
      <pixel-draw-panel
        uv-resize
        texture-resizable
        uv-overflow="64"
        uv-access=${this.editing?.access.current.has("uv") === false ? "view" : "edit"}
      ></pixel-draw-panel>
    `;
  }
}

customElements.define("jolly-model-editor-left-panel", LeftPanel);
