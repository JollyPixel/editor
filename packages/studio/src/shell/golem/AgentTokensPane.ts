// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  state
} from "lit/decorators.js";
import type { AgentToken } from "@jolly-pixel/accounts";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/icon";
import "@jolly-pixel/ui/elements/toolbar";
import { showConfirm } from "@jolly-pixel/ui/elements/dialog";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/message";

// Import Internal Dependencies
import { agentSetupLine } from "../../golem/AgentSetupLine.ts";
import type { StudioAgentTokens } from "../../golem/StudioAgentTokens.ts";
import { RemoteStateController } from "../RemoteStateController.ts";
import { listRowStyles } from "../listRowStyles.ts";

// CONSTANTS
const kDate = new Intl.DateTimeFormat("en", {
  dateStyle: "medium"
});

interface RevealedToken {
  id: string;
  name: string;
  setupLine: string;
}

@customElement("studio-agent-tokens")
export class AgentTokensPane extends LitElement {
  static override styles = [listRowStyles, css`
    :host {
      display: grid;
      gap: var(--jolly-space-2);
    }

    p {
      margin: 0;
    }

    .intro {
      color: var(--jolly-text-muted);
    }

    .create {
      display: flex;
      align-items: end;
      gap: var(--jolly-space-2);
    }

    .create jolly-text {
      flex: 1;
    }

    .revealed {
      display: grid;
      gap: var(--jolly-space-2);
      padding: var(--jolly-space-2);
      border-radius: var(--jolly-radius-sm);
      background: var(--jolly-surface-sunken);
    }

    code {
      overflow-wrap: anywhere;
      user-select: all;
    }
  `];

  @state()
  declare _name: string;

  @state()
  declare _revealed: RevealedToken | null;

  @state()
  declare _copied: boolean;

  #tokens = new RemoteStateController<StudioAgentTokens>(this);

  constructor() {
    super();
    this._name = "";
    this._revealed = null;
    this._copied = false;
  }

  set tokens(
    tokens: StudioAgentTokens
  ) {
    this.#tokens.attach(tokens);
    void tokens.load();
  }

  override render(): TemplateResult {
    const tokens = this.#tokens.current?.tokens ?? [];

    return html`
      <p class="intro">
        A token lets a local AI agent join this studio with your role.
        It shows in the peer lists under its name, marked "via golem".
      </p>
      <div class="create">
        <jolly-text
          data-field="token-name"
          label="Name"
          placeholder="Golem"
          .value=${this._name}
          @jolly-input=${(event: CustomEvent<{ value: string; }>) => {
            this._name = event.detail.value;
          }}
        ></jolly-text>
        <jolly-button
          variant="accent"
          data-action="create"
          @click=${this.#create}
        >New token</jolly-button>
      </div>
      ${this.#renderRevealed()}
      ${this.#tokens.error()}
      ${tokens.length === 0 ? html`
        <jolly-message flush>No agent token.</jolly-message>
      ` : html`
        <ul class="rows" aria-label="Agent tokens">
          ${tokens.map((token) => this.#renderToken(token))}
        </ul>
      `}
    `;
  }

  #renderRevealed(): TemplateResult | typeof nothing {
    const revealed = this._revealed;
    if (revealed === null) {
      return nothing;
    }

    return html`
      <div class="revealed" data-token=${revealed.id}>
        <p>
          Run this line to add "${revealed.name}" to Claude Code.
          The token is shown only now.
        </p>
        <code>${revealed.setupLine}</code>
        <jolly-toolbar label="Token actions">
          <jolly-button
            variant="accent"
            data-action="copy"
            @click=${this.#copy}
          >${this._copied ? "Copied" : "Copy"}</jolly-button>
          <jolly-button
            data-action="dismiss"
            @click=${this.#dismiss}
          >Done</jolly-button>
        </jolly-toolbar>
      </div>
    `;
  }

  #renderToken(
    token: AgentToken
  ): TemplateResult {
    return html`
      <li data-token=${token.id}>
        <jolly-icon name="key"></jolly-icon>
        <div class="row-text">
          <span class="row-title">${token.name}</span>
          <span class="row-meta">Created on ${kDate.format(token.createdAt)}.</span>
        </div>
        <jolly-button
          variant="danger"
          data-action="revoke"
          @click=${() => this.#revoke(token)}
        >Revoke</jolly-button>
      </li>
    `;
  }

  readonly #create = async(): Promise<void> => {
    const tokens = this.#tokens.current;
    if (tokens === null) {
      return;
    }

    const name = this._name.trim();
    const created = await tokens.create(name === "" ? undefined : name);
    if (created === null) {
      return;
    }
    this._name = "";
    this._copied = false;
    this._revealed = {
      id: created.token.id,
      name: created.token.name,
      setupLine: agentSetupLine({
        studioUrl: new URL(".", document.baseURI).href,
        token: created.value
      })
    };
  };

  readonly #copy = async(): Promise<void> => {
    if (this._revealed === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this._revealed.setupLine);
      this._copied = true;
    }
    catch {
      this._copied = false;
    }
  };

  readonly #dismiss = (): void => {
    this._revealed = null;
  };

  async #revoke(
    token: AgentToken
  ): Promise<void> {
    const confirmed = await showConfirm({
      title: `Revoke "${token.name}"?`,
      message: "Agents using it are disconnected, and the token stops working for good.",
      confirmLabel: "Revoke",
      danger: true
    });
    if (!confirmed) {
      return;
    }

    await this.#tokens.current?.revoke(token.id);
    if (this._revealed?.id === token.id) {
      this._revealed = null;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-agent-tokens": AgentTokensPane;
  }
}
