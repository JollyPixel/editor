// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import {
  AGENT_CHAT_TEXT_MAX_LENGTH,
  type AgentBridgePermission,
  type AgentChatEntry
} from "@jolly-pixel/server";
import "@jolly-pixel/ui/elements/avatar";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/icon";
import "@jolly-pixel/ui/elements/message";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import {
  AGENT_CHAT_CHANGE,
  type ChatAgent,
  type ChatAgentBridge,
  type ChatGroup,
  type StudioAgentChat
} from "../../golem/StudioAgentChat.ts";
import { ChangeController } from "../ChangeController.ts";
import { assetOpenEvent } from "../assets/assetOpen.ts";
import { ACCESS_KEYS_SECTION } from "../settings/SettingsSections.ts";
import { SettingsOpenEvent } from "../settings/SettingsOpenEvent.ts";
import { golemChatStyles } from "./golemChatStyles.ts";

// CONSTANTS
const kTime = new Intl.DateTimeFormat("en", {
  timeStyle: "short"
});
const kCountShownBelow = 500;

@customElement("studio-golem-chat")
export class GolemChatPane extends LitElement {
  static override styles = golemChatStyles;

  @property({ attribute: false })
  declare catalog: CatalogClient | null;

  @state()
  declare _draft: string;

  @state()
  declare _error: string | null;

  @query("textarea")
  declare _prompt: HTMLTextAreaElement | null;

  @query(".feed")
  declare _feed: HTMLElement | null;

  #chat = new ChangeController<StudioAgentChat>(this, AGENT_CHAT_CHANGE);
  #groups: ChatGroup[] = [];
  #agents: ChatAgent[] = [];
  #scrolledHeight = 0;

  constructor() {
    super();
    this.catalog = null;
    this._draft = "";
    this._error = null;
  }

  set chat(
    chat: StudioAgentChat
  ) {
    this.#chat.attach(chat);
  }

  protected override willUpdate(): void {
    const chat = this.#chat.current;
    this.hidden = chat?.visible !== true;
    this.#groups = chat?.groups ?? [];
    this.#agents = chat?.agents ?? [];
    if (this.hidden) {
      this.#scrolledHeight = 0;
    }
  }

  async focusPrompt(): Promise<void> {
    await this.updateComplete;
    this._prompt?.focus();
  }

  override render(): TemplateResult {
    const chat = this.#chat.current;

    return html`
      <header>
        <jolly-icon name="chat"></jolly-icon>
        <h2>Golem</h2>
        <jolly-button
          icon="close"
          icon-only
          label="Close the golem chat"
          title="Close"
          @click=${() => chat?.hide()}
        ></jolly-button>
      </header>
      ${this.#agents.length === 0 ? this.#renderNoAgent() : html`
        <ul class="agents" aria-label="Agents">
          ${this.#agents.map((agent) => this.#renderAgent(agent))}
        </ul>
      `}
      <div class="feed">
        <ol class="lines" aria-label="Messages" aria-live="polite">${
          this.#groups.map((group) => this.#renderGroup(group))
        }</ol>
        ${this.#groups.length === 0 && this.#agents.length > 0 ? html`
          <p class="empty">
            No messages yet. Ask the agents to build, paint or tidy up the
            project.
          </p>
        ` : nothing}
        ${this.#agents.map((agent) => this.#renderPermissions(agent))}
        ${this.#agents.map((agent) => this.#renderWorking(agent))}
      </div>
      ${this.#renderPrompt(chat)}
    `;
  }

  protected override updated(): void {
    const feed = this._feed;
    if (
      this.hidden ||
      feed === null ||
      feed.scrollHeight === this.#scrolledHeight
    ) {
      return;
    }

    feed.scrollTop = feed.scrollHeight;
    this.#scrolledHeight = feed.scrollHeight;
  }

  #renderNoAgent(): TemplateResult {
    return html`
      <div class="notice">
        <jolly-message>
          No agent is connected. Create a token in
          <button
            class="link"
            type="button"
            @click=${this.#openAgents}
          >Settings › Access keys</button>
          and run its setup line.
        </jolly-message>
      </div>
    `;
  }

  #renderAgent(
    agent: ChatAgent
  ): TemplateResult {
    const { controls } = agent;
    const running = agent.bridge?.turn === "running";

    return html`
      <li class="agent">
        <jolly-avatar
          peer-id=${agent.tokenId}
          color=${agent.color}
          presence="online"
        ></jolly-avatar>
        <span class="who">
          <span class="name">
            ${agent.username}${agent.ownerName === null ? nothing : html`
              <span class="owner">· ${agent.ownerName}</span>
            `}
          </span>
          <span class="status" ?data-running=${running}>
            ${this.#agentStatus(agent)}
          </span>
        </span>
        ${controls?.turn === "running" ? html`
          <jolly-button
            icon="stop"
            icon-only
            variant="danger"
            label=${`Stop ${agent.username}`}
            title="Stop"
            @click=${() => this.#chat.current?.stop(controls)}
          ></jolly-button>
        ` : nothing}
      </li>
    `;
  }

  #agentStatus(
    agent: ChatAgent
  ): string {
    const { activity, bridge } = agent;
    if (activity !== null) {
      return `${activity.label} in ${this.#assetPath(activity.assetId)}`;
    }

    return bridge?.turn === "running" ? bridge.tool ?? "Working" : "Idle";
  }

  #renderGroup(
    group: ChatGroup
  ): TemplateResult {
    const [first] = group.entries;

    return html`
      <li
        class="group"
        ?data-agent=${group.agent}
        style=${`--author: ${group.color}`}
      >
        <jolly-avatar
          peer-id=${first.peerId ?? first.clientId}
          color=${group.color}
        ></jolly-avatar>
        <div class="body">
          <div class="meta">
            <span class="author">${first.username}</span>
            ${first.via === undefined ? nothing : html`
              <span class="via">${first.via}</span>
            `}
            <time datetime=${new Date(first.at).toISOString()}>
              ${kTime.format(first.at)}
            </time>
          </div>
          ${group.entries.map((entry) => this.#renderEntry(entry))}
        </div>
      </li>
    `;
  }

  #renderEntry(
    entry: AgentChatEntry
  ): TemplateResult {
    const { assetId } = entry;

    return html`
      <p class="text" title=${kTime.format(entry.at)}>${entry.text}</p>
      ${assetId === undefined ? nothing : html`
        <button
          class="asset"
          type="button"
          title="Open the asset"
          @click=${() => this.dispatchEvent(assetOpenEvent(assetId))}
        >${this.#assetPath(assetId)}</button>
      `}
    `;
  }

  #renderPermissions(
    agent: ChatAgent
  ): TemplateResult[] {
    const { controls } = agent;

    return controls === null ? [] : controls.permissions.map(
      (permission) => this.#renderPermission(agent, controls, permission)
    );
  }

  #renderPermission(
    agent: ChatAgent,
    bridge: ChatAgentBridge,
    permission: AgentBridgePermission
  ): TemplateResult {
    return html`
      <section
        class="card"
        role="group"
        aria-label="Permission request"
        style=${`--author: ${agent.color}`}
      >
        <p>
          <span class="author">${agent.username}</span>
          <span class="muted">asks for permission</span>
        </p>
        <p class="text">${permission.title}</p>
        <div class="options">
          ${permission.options.map((option) => html`
            <jolly-button
              variant=${option.kind === "allow_once" ? "accent" : "default"}
              @click=${() => this.#chat.current?.answer(
                bridge,
                permission.id,
                option.optionId
              )}
            >${option.name}</jolly-button>
          `)}
        </div>
      </section>
    `;
  }

  #renderWorking(
    agent: ChatAgent
  ): TemplateResult | typeof nothing {
    if (agent.bridge?.turn !== "running") {
      return nothing;
    }

    return html`
      <p class="working" style=${`--author: ${agent.color}`}>
        <span class="dots" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
        ${agent.username} is working…
      </p>
    `;
  }

  #renderPrompt(
    chat: StudioAgentChat | null
  ): TemplateResult {
    if (chat !== null && !chat.canSay) {
      return html`
        <p class="read-only">Your role can read the chat but not write in it.</p>
      `;
    }

    const remaining = AGENT_CHAT_TEXT_MAX_LENGTH - this._draft.length;

    return html`
      <form @submit=${this.#send}>
        <div class="box">
          <textarea
            rows="2"
            maxlength=${AGENT_CHAT_TEXT_MAX_LENGTH}
            aria-label="Message to the agents"
            placeholder="Write to the agents…"
            ?disabled=${chat === null}
            .value=${this._draft}
            @input=${this.#onInput}
            @keydown=${this.#onKeyDown}
          ></textarea>
          <jolly-button
            type="submit"
            icon="send"
            icon-only
            variant="accent"
            label="Send"
            title="Send"
            ?disabled=${chat === null || this._draft.trim() === ""}
          ></jolly-button>
        </div>
        <div class="hint">
          <span>Enter to send · Shift+Enter for a new line</span>
          ${remaining > kCountShownBelow ? nothing : html`
            <span class="count" ?data-over=${remaining <= 0}>${remaining}</span>
          `}
        </div>
        ${this._error === null ? nothing : html`
          <p class="error" role="alert">${this._error}</p>
        `}
      </form>
    `;
  }

  #assetPath(
    assetId: string
  ): string {
    return this.catalog?.record(assetId)?.path.toString() ?? assetId;
  }

  readonly #onInput = (
    event: InputEvent
  ): void => {
    const target = event.currentTarget;
    if (target instanceof HTMLTextAreaElement) {
      this._draft = target.value;
    }
  };

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.#send();
    }
  };

  readonly #send = async(
    event?: SubmitEvent
  ): Promise<void> => {
    event?.preventDefault();
    const chat = this.#chat.current;
    const text = this._draft.trim();
    if (chat === null || text === "") {
      return;
    }

    this._draft = "";
    this._error = null;
    try {
      await chat.say(text);
    }
    catch (error) {
      this._draft = text;
      this._error = errorMessage(error);
    }
  };

  readonly #openAgents = (): void => {
    this.dispatchEvent(new SettingsOpenEvent(ACCESS_KEYS_SECTION));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-golem-chat": GolemChatPane;
  }
}
