// Import Third-party Dependencies
import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { query, state } from "lit/decorators.js";
import type {
  JollyPeerSelectDetail,
  PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ModelWorkspace } from "../scene/index.ts";
import type { HierarchyPanel } from "../features/hierarchy/HierarchyPanel.ts";
import type { TransformPanel } from "../features/transform/TransformPanel.ts";
import "../features/hierarchy/HierarchyPanel.ts";
import "../features/transform/TransformPanel.ts";

export class RightPanel extends LitElement {
  #workspace: ModelWorkspace | null = null;
  #unsubscribePresence: (() => void) | null = null;

  @query("jolly-model-editor-transform")
  declare private transformElement: TransformPanel;

  @query("jolly-model-editor-hierarchy")
  declare private hierarchyElement: HierarchyPanel;

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

    jolly-folder[key="transform"]::part(header),
    jolly-folder[key="collaborators"]::part(header) {
      font-size: calc(var(--jolly-font-size, 11px) + 2px);
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

    this.#unsubscribePresence?.();
    this._peers = presence.peers;
    this.#unsubscribePresence = presence.subscribe(
      "peersChange",
      (peers) => {
        this._peers = peers;
      }
    );

    await this.updateComplete;
    this.transformElement.attach(workspace);
    this.hierarchyElement.attach(workspace);
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
      <jolly-model-editor-hierarchy></jolly-model-editor-hierarchy>
      ${this.#renderCollaborators()}
    `;
  }
}

customElements.define("jolly-model-editor-right-panel", RightPanel);
