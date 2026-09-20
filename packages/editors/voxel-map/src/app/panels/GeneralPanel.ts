// Import Third-party Dependencies
import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import type {
  JollyPeerSelectDetail,
  PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../scene/EditorScene.ts";
import { WorkspaceController } from "../../shared/WorkspaceController.ts";

import "../../features/registerElements.ts";

@customElement("general-panel")
export class GeneralPanel extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @state()
  declare _peers: readonly PresencePeer[];

  #workspace = new WorkspaceController(this, (workspace) => {
    this._peers = workspace.state.presence.peers;

    return [
      workspace.state.presence.subscribe("peersChange", (peers) => {
        this._peers = peers;
      }),
      workspace.mapDocument.subscribe("reset", () => this.requestUpdate())
    ];
  });

  constructor() {
    super();
    this._peers = [];
  }

  attach(
    workspace: VoxelMapWorkspace
  ): void {
    this.#workspace.attach(workspace);
  }

  readonly #onPeerSelect = (
    event: CustomEvent<JollyPeerSelectDetail>
  ): void => {
    this.#workspace.current?.teleportToPeer(event.detail.clientId);
  };

  override render() {
    const workspace = this.#workspace.current;
    if (workspace === null) {
      return nothing;
    }

    return html`
      ${this.#renderCollaborators()}

      <jolly-folder
        key="map-config"
        label="Map Config"
        storage-key="voxel-map:folder:map-config"
      >
        <map-config-panel .workspace=${workspace}></map-config-panel>
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
