// Import Third-party Dependencies
import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { query, state } from "lit/decorators.js";
import {
  SubscriptionController,
  type JollyPeerSelectDetail,
  type PresencePeer
} from "@jolly-pixel/ui";
import "@jolly-pixel/editor.host/ui";

// Import Internal Dependencies
import type { ModelWorkspace } from "../scene/ModelEditorScene.ts";
import type { HierarchyPanel } from "../features/hierarchy/HierarchyPanel.ts";
import "../features/hierarchy/HierarchyPanel.ts";
import type { ViewPanel } from "../features/view/ViewPanel.ts";
import "../features/view/ViewPanel.ts";

export class RightPanel extends LitElement {
  #workspace = new SubscriptionController<ModelWorkspace>(this, ({ presence }) => {
    this._peers = presence.peers;

    return [
      presence.subscribe("peersChange", (peers) => {
        this._peers = peers;
      })
    ];
  });

  @query("jolly-model-editor-hierarchy")
  declare private hierarchyElement: HierarchyPanel;

  @query("jolly-model-editor-view")
  declare private viewElement: ViewPanel;

  @state()
  private declare _peers: readonly PresencePeer[];

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      font: inherit;

      --jolly-folder-gap: var(--jolly-space-1, 4px);
    }

    jolly-folder[key="collaborators"]::part(header),
    jolly-folder[key="file"]::part(header) {
      font-size: calc(var(--jolly-font-size, 11px) + 2px);
    }

    jolly-archive-actions {
      padding: var(--jolly-space-1, 4px);
    }
  `;

  constructor() {
    super();
    this._peers = [];
  }

  async attach(
    workspace: ModelWorkspace
  ): Promise<void> {
    this.#workspace.attach(workspace);

    await this.updateComplete;
    this.hierarchyElement.attach(workspace);
    this.viewElement.attach(workspace);
  }

  readonly #onPeerSelect = (
    event: CustomEvent<JollyPeerSelectDetail>
  ): void => {
    this.#workspace.current?.teleportToPeer(event.detail.clientId);
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
      <jolly-model-editor-hierarchy></jolly-model-editor-hierarchy>
      <jolly-model-editor-view></jolly-model-editor-view>
      ${this.#renderCollaborators()}
      ${this.#renderFile()}
    `;
  }

  #renderFile(): TemplateResult | typeof nothing {
    const workspace = this.#workspace.current;
    if (workspace === null) {
      return nothing;
    }

    return html`
      <jolly-folder key="file" label="File" .open=${false}>
        <jolly-archive-actions
          .archives=${workspace.archives}
        ></jolly-archive-actions>
      </jolly-folder>
    `;
  }
}

customElements.define("jolly-model-editor-right-panel", RightPanel);
