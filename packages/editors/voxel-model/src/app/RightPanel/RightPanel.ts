// Import Third-party Dependencies
import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import type {
  JollyPeerSelectDetail,
  PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type ModelManager from "../../features/groups/ModelManager.ts";
import type { ModelSceneComponent } from "../ModelSceneComponent.ts";
import type { PresenceStore } from "../state/index.ts";
import { BlockTreeController } from "./BlockTreeController.ts";
import "./blockIcons.ts";

export class RightPanel extends LitElement {
  #tree = new BlockTreeController(this);
  #sceneManager: ModelSceneComponent | null = null;
  #unsubscribePresence: (() => void) | null = null;

  @state()
  private declare _peers: readonly PresencePeer[];

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      font: inherit;
    }

    jolly-toolbar {
      padding: var(--jolly-space-2, 8px);
    }

    jolly-tree {
      flex: 1 1 auto;
      overflow: auto;
      padding-inline: var(--jolly-space-1, 4px);
    }
  `;

  constructor() {
    super();
    this._peers = [];
  }

  public setModelManager(
    modelManager: ModelManager
  ): void {
    this.#tree.setModelManager(modelManager);
  }

  public setSceneManager(
    sceneManager: ModelSceneComponent
  ): void {
    this.#sceneManager = sceneManager;
    this.#tree.setSceneManager(sceneManager);
  }

  public setPresence(
    presence: PresenceStore
  ): void {
    this.#unsubscribePresence?.();
    this.#tree.setPresence(presence);
    this._peers = presence.peers;
    this.#unsubscribePresence = presence.watch(
      "peersChange",
      (peers) => {
        this._peers = peers;
      }
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribePresence?.();
    this.#unsubscribePresence = null;
  }

  readonly #onPeerSelect = (
    event: CustomEvent<JollyPeerSelectDetail>
  ): void => {
    this.#sceneManager?.teleportToPeer(event.detail.clientId);
  };

  #renderCollaborators(): TemplateResult | typeof nothing {
    if (this._peers.length === 0) {
      return nothing;
    }

    return html`
      <jolly-folder
        key="collaborators"
        label="Collaborators"
        storage-key="voxel-model:folder:collaborators"
      >
        <jolly-presence
          selectable
          .peers=${this._peers}
          @jolly-peer-select=${this.#onPeerSelect}
        ></jolly-presence>
      </jolly-folder>
    `;
  }

  override render(): TemplateResult {
    return html`
      ${this.#renderCollaborators()}
      <jolly-toolbar label="Actions">
        <jolly-tool-button
          icon="plus"
          label="Add Block"
          @click=${this.#tree.addBlock}
        ></jolly-tool-button>
        <jolly-tool-button
          icon="block-duplicate"
          label="Duplicate"
          ?disabled=${!this.#tree.hasSelection}
          @click=${this.#tree.duplicateSelected}
        ></jolly-tool-button>
        <jolly-tool-button
          icon="block-delete"
          label="Delete"
          ?disabled=${!this.#tree.hasSelection}
          @click=${this.#tree.deleteSelected}
        ></jolly-tool-button>
      </jolly-toolbar>
      <jolly-tree
        .nodes=${this.#tree.nodes}
        .selected=${this.#tree.selected}
        .expanded=${this.#tree.expanded}
        reorderable
        row-drag
        renamable
        @jolly-select=${this.#tree.handleSelect}
        @jolly-toggle-expand=${this.#tree.handleToggleExpand}
        @jolly-rename=${this.#tree.handleRename}
        @jolly-reparent=${this.#tree.handleReparent}
      ></jolly-tree>
    `;
  }
}

customElements.define("jolly-model-editor-right-panel", RightPanel);
