// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type {
  JollyPeerSelectDetail,
  PresencePeer
} from "@jolly-pixel/ui";
import type {
  VoxelEngine,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  editorState,
  type EditorState
} from "../state/index.ts";
import type { GridRenderer } from "../../scene/GridRenderer.ts";
import type { SceneLighting } from "../../scene/SceneLighting.ts";
import type { LocalBrush } from "../../features/painting/index.ts";

import "../../features/registerElements.ts";

@customElement("general-panel")
export class GeneralPanel extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine | undefined;

  @property({ attribute: false })
  declare gridRenderer: GridRenderer | undefined;

  @property({ attribute: false })
  declare lighting: SceneLighting | undefined;

  @property({ attribute: false })
  declare localBrush: LocalBrush | undefined;

  @property({ attribute: false })
  declare onLoadWorld: ((data: VoxelWorldJSON) => void) | undefined;

  @property({ attribute: false })
  declare onTeleportToPeer: ((clientId: string) => void) | undefined;

  @property({ attribute: false })
  declare state: EditorState;

  @state()
  declare _peers: readonly PresencePeer[];

  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.engine = undefined;
    this.gridRenderer = undefined;
    this.lighting = undefined;
    this.localBrush = undefined;
    this.onLoadWorld = undefined;
    this.onTeleportToPeer = undefined;
    this.state = editorState;
    this._peers = this.state.presence.peers;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#unsubscribe = this.state.presence.watch(
      "peersChange",
      this.#onPeersChange
    );
    this.#onPeersChange(this.state.presence.peers);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  readonly #onPeersChange = (peers: readonly PresencePeer[]): void => {
    this._peers = peers;
  };

  readonly #onPeerSelect = (
    event: CustomEvent<JollyPeerSelectDetail>
  ): void => {
    this.onTeleportToPeer?.(event.detail.clientId);
  };

  override render() {
    return html`
      ${this.#renderCollaborators()}

      <jolly-folder
        key="map-config"
        label="Map Config"
        storage-key="voxel-map:folder:map-config"
      >
        <map-config-panel
          .engine=${this.engine}
          .gridRenderer=${this.gridRenderer}
          .lighting=${this.lighting}
          .localBrush=${this.localBrush}
          .onLoadWorld=${this.onLoadWorld}
        ></map-config-panel>
      </jolly-folder>
    `;
  }

  #renderCollaborators() {
    if (this._peers.length === 0) {
      return nothing;
    }

    return html`
      <jolly-folder
        key="collaborators"
        label="Collaborators"
        storage-key="voxel-map:folder:collaborators"
      >
        <jolly-presence
          selectable
          .peers=${this._peers}
          @jolly-peer-select=${this.#onPeerSelect}
        ></jolly-presence>
      </jolly-folder>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "general-panel": GeneralPanel;
  }
}
