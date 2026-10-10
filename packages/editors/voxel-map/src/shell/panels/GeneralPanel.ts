// Import Third-party Dependencies
import {
  html,
  css,
  nothing
} from "lit";
import {
  customElement,
  state
} from "lit/decorators.js";
import type {
  JollyPeerSelectDetail,
  PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";

@customElement("general-panel")
export class GeneralPanel extends WorkspaceElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @state()
  declare _peers: readonly PresencePeer[];

  constructor() {
    super();
    this._peers = [];
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    this._peers = workspace.state.presence.peers;

    return [
      workspace.state.presence.subscribe("peersChange", (peers) => {
        this._peers = peers;
      }),
      workspace.mapDocument.subscribe(
        "reset",
        () => this.requestUpdate()
      )
    ];
  }

  readonly #onPeerSelect = (
    event: CustomEvent<JollyPeerSelectDetail>
  ): void => {
    this.workspace?.teleportToPeer(event.detail.clientId);
  };

  override render() {
    if (this.workspace === null) {
      return nothing;
    }

    return this.#renderCollaborators();
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
