// Import Third-party Dependencies
import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { query, state } from "lit/decorators.js";
import type {
  JollyPeerSelectDetail,
  PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ModelWorkspace } from "../scene/index.ts";
import { HierarchyController } from "../features/hierarchy/HierarchyController.ts";
import type { TransformPanel } from "../features/transform/TransformPanel.ts";
import "../features/hierarchy/hierarchyIcons.ts";
import "../features/transform/TransformPanel.ts";

export class RightPanel extends LitElement {
  #tree = new HierarchyController(this);
  #workspace: ModelWorkspace | null = null;
  #unsubscribePresence: (() => void) | null = null;

  @query("jolly-model-editor-transform")
  declare private transformElement: TransformPanel;

  @state()
  private declare _peers: readonly PresencePeer[];

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      font: inherit;

      --jolly-folder-gap: var(--jolly-space-2, 8px);
    }

    jolly-folder[key="hierarchy"] {
      flex: 1 1 auto;
      min-height: 0;
    }

    jolly-folder[key="transform"]::part(header),
    jolly-folder[key="hierarchy"]::part(header),
    jolly-folder[key="collaborators"]::part(header) {
      font-size: calc(var(--jolly-font-size, 11px) + 2px);
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

  async attach(
    workspace: ModelWorkspace
  ): Promise<void> {
    const { presence } = workspace;
    this.#workspace = workspace;
    this.#tree.attach(workspace);

    this.#unsubscribePresence?.();
    this._peers = presence.peers;
    this.#unsubscribePresence = presence.watch(
      "peersChange",
      (peers) => {
        this._peers = peers;
      }
    );

    await this.updateComplete;
    this.transformElement.attach(workspace);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribePresence?.();
    this.#unsubscribePresence = null;
  }

  readonly #onPeerSelect = (
    event: CustomEvent<JollyPeerSelectDetail>
  ): void => {
    this.#workspace?.teleportToPeer(event.detail.clientId);
  };

  #renderCollaborators(): TemplateResult | typeof nothing {
    if (this._peers.length === 0) {
      return nothing;
    }

    return html`
      <jolly-folder
        key="collaborators"
        label="Collaborators"
        .collapsible=${false}
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
      <jolly-folder
        key="transform"
        label="Transform"
        .collapsible=${false}
        flush
      >
        <jolly-model-editor-transform></jolly-model-editor-transform>
      </jolly-folder>
      <jolly-folder
        key="hierarchy"
        label="Hierarchy"
        .collapsible=${false}
        flush
      >
        <jolly-button
          slot="actions"
          icon="plus"
          icon-only
          label="Add Block"
          title="Add Block"
          @click=${this.#tree.addBlock}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="folder-add"
          icon-only
          label="Add Folder"
          title="Add Folder"
          @click=${this.#tree.addFolder}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="block-duplicate"
          icon-only
          label="Duplicate"
          title="Duplicate"
          ?disabled=${!this.#tree.hasSelection}
          @click=${this.#tree.duplicateSelected}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="block-delete"
          icon-only
          label="Delete"
          title="Delete"
          ?disabled=${!this.#tree.hasSelection}
          @click=${this.#tree.deleteSelected}
        ></jolly-button>
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
      </jolly-folder>
      ${this.#renderCollaborators()}
    `;
  }
}

customElements.define("jolly-model-editor-right-panel", RightPanel);
