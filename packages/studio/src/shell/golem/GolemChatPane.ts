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
  property,
  query,
  state
} from "lit/decorators.js";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/message";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import {
  AGENT_CHAT_CHANGE,
  type ChatAgent,
  type ChatLine,
  type StudioAgentChat
} from "../../golem/StudioAgentChat.ts";
import { ChangeController } from "../ChangeController.ts";
import { AGENTS_SECTION } from "../settings/SettingsSections.ts";
import { SettingsOpenEvent } from "../settings/SettingsOpenEvent.ts";

// CONSTANTS
const kTime = new Intl.DateTimeFormat("en", {
  timeStyle: "short"
});

@customElement("studio-golem-chat")
export class GolemChatPane extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 320px;
      min-height: 0;
      margin: 0 var(--studio-gutter) var(--studio-gutter) 0;
      overflow: hidden;
      border-radius: var(--studio-radius);
      background: var(--studio-board);
      box-shadow: inset 0 -1px 0 var(--studio-shade);
    }

    :host([hidden]) {
      display: none;
    }

    header {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2, 8px);
      padding: var(--jolly-space-1, 4px) var(--jolly-space-2, 8px);
      box-shadow: var(--studio-bevel);

      --jolly-icon-button-size: 24px;
    }

    h2 {
      flex: 1;
      margin: 0;
      font-size: inherit;
    }

    .agents,
    .lines {
      display: grid;
      gap: var(--jolly-space-1, 4px);
      margin: 0;
      padding: var(--jolly-space-2, 8px);
      list-style: none;
    }

    .agents {
      border-block-end: 1px solid var(--studio-shade);
    }

    .lines {
      flex: 1;
      align-content: start;
      overflow-y: auto;
    }

    .author {
      font-weight: 600;
    }

    .muted {
      color: var(--jolly-text-muted);
    }

    .text {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .link {
      padding: 0;
      border: none;
      background: none;
      color: var(--jolly-accent);
      font: inherit;
      cursor: pointer;
    }

    form {
      display: grid;
      gap: var(--jolly-space-1, 4px);
      padding: var(--jolly-space-2, 8px);
      box-shadow: var(--studio-bevel);
    }

    textarea {
      min-height: 3lh;
      resize: vertical;
      font: inherit;
    }

    .error {
      color: var(--jolly-danger);
    }
  `;

  @property({ attribute: false })
  declare catalog: CatalogClient | null;

  @state()
  declare _draft: string;

  @state()
  declare _error: string | null;

  @query("textarea")
  declare _prompt: HTMLTextAreaElement | null;

  @query(".lines")
  declare _lines: HTMLElement | null;

  #chat = new ChangeController<StudioAgentChat>(this, AGENT_CHAT_CHANGE);
  #lines: ChatLine[] = [];
  #scrolledTo: string | null = null;

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
    this.#lines = chat?.lines ?? [];
    if (this.hidden) {
      this.#scrolledTo = null;
    }
  }

  async focusPrompt(): Promise<void> {
    await this.updateComplete;
    this._prompt?.focus();
  }

  override render(): TemplateResult {
    const chat = this.#chat.current;
    const agents = chat?.agents ?? [];

    return html`
      <header>
        <h2>Golem</h2>
        <jolly-button
          icon="close"
          icon-only
          label="Close the golem chat"
          title="Close"
          @click=${() => chat?.hide()}
        ></jolly-button>
      </header>
      ${agents.length === 0 ? this.#renderNoAgent() : html`
        <ul class="agents" aria-label="Agents">
          ${agents.map((agent) => this.#renderAgent(agent))}
        </ul>
      `}
      <ol class="lines" aria-label="Messages" aria-live="polite">
        ${this.#lines.map((line) => this.#renderLine(line))}
      </ol>
      ${this.#renderPrompt(chat)}
    `;
  }

  protected override updated(): void {
    const list = this._lines;
    const newest = this.#lines.at(-1)?.entry.id ?? null;
    if (this.hidden || list === null || newest === this.#scrolledTo) {
      return;
    }

    list.scrollTop = list.scrollHeight;
    this.#scrolledTo = newest;
  }

  #renderNoAgent(): TemplateResult {
    return html`
      <jolly-message>
        No agent is connected. Create a token in
        <button
          class="link"
          type="button"
          @click=${this.#openAgents}
        >Settings › Agents</button>
        and run its setup line.
      </jolly-message>
    `;
  }

  #renderAgent(
    agent: ChatAgent
  ): TemplateResult {
    const { activity } = agent;

    return html`
      <li>
        <span class="author" style=${`color: ${agent.color}`}>
          ${agent.username}
        </span>
        <span class="muted">${activity === null ?
          "idle" :
          `${activity.label}${this.#assetSuffix(activity.assetId)}`}</span>
      </li>
    `;
  }

  #renderLine(
    line: ChatLine
  ): TemplateResult {
    const { entry } = line;

    return html`
      <li>
        <span class="author" style=${`color: ${line.color}`}>
          ${entry.username}
        </span>
        ${entry.via === undefined ? nothing : html`
          <span class="muted">via ${entry.via}</span>
        `}
        <span class="muted">
          ${kTime.format(entry.at)}${entry.assetId === undefined ?
            "" :
            this.#assetSuffix(entry.assetId)}
        </span>
        <p class="text">${entry.text}</p>
      </li>
    `;
  }

  #renderPrompt(
    chat: StudioAgentChat | null
  ): TemplateResult {
    const disabled = chat === null || !chat.canSay;

    return html`
      <form @submit=${this.#send}>
        <textarea
          aria-label="Message to the agents"
          placeholder=${disabled ?
            "Your role can read the chat but not write in it." :
            "Write to the agents, Enter to send"}
          ?disabled=${disabled}
          .value=${this._draft}
          @input=${this.#onInput}
          @keydown=${this.#onKeyDown}
        ></textarea>
        ${this._error === null ? nothing : html`
          <span class="error">${this._error}</span>
        `}
      </form>
    `;
  }

  #assetSuffix(
    assetId: string
  ): string {
    const path = this.catalog?.record(assetId)?.path.toString();

    return ` in ${path ?? assetId}`;
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
    this.dispatchEvent(new SettingsOpenEvent(AGENTS_SECTION));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-golem-chat": GolemChatPane;
  }
}
