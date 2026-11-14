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
  state
} from "lit/decorators.js";
import "@jolly-pixel/ui/elements/button";

// Import Internal Dependencies
import {
  STUDIO_USER_CHANGE,
  type StudioUser
} from "../../accounts/StudioUser.ts";
import {
  AGENT_CHAT_CHANGE,
  type StudioAgentChat
} from "../../golem/StudioAgentChat.ts";
import type { StudioPlay } from "../../play/StudioPlay.ts";
import { ChangeController } from "../ChangeController.ts";
import { StudioErrorEvent } from "../StudioErrorEvent.ts";
import { SettingsOpenEvent } from "../settings/SettingsOpenEvent.ts";
import {
  askExport,
  exportFile
} from "./askExport.ts";

@customElement("studio-header-actions")
export class HeaderActions extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    jolly-button {
      --jolly-control-height: 30px;
      --jolly-icon-button-size: 30px;
      --jolly-icon-size: 18px;
      --jolly-control-bg: transparent;
      --jolly-control-bg-hover: color-mix(
        in oklab,
        var(--studio-board) 80%,
        transparent
      );
      --jolly-control-bg-active: var(--studio-board);
    }

    jolly-button[data-open] {
      --jolly-control-bg: var(--studio-board);
    }
  `;

  @property({ attribute: false })
  declare play: StudioPlay | null;

  @property({ attribute: false })
  declare agentChat: StudioAgentChat | null;

  @state()
  declare _exporting: boolean;

  #user = new ChangeController<StudioUser>(this, STUDIO_USER_CHANGE);
  #chat = new ChangeController<StudioAgentChat>(this, AGENT_CHAT_CHANGE);

  constructor() {
    super();
    this.play = null;
    this.agentChat = null;
    this._exporting = false;
  }

  set user(
    user: StudioUser | null
  ) {
    if (user !== null) {
      this.#user.attach(user);
    }
  }

  protected override willUpdate(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("agentChat") && this.agentChat !== null) {
      this.#chat.attach(this.agentChat);
    }
  }

  override render(): TemplateResult {
    const user = this.#user.current;
    const canExport = user?.online === true && user.rights.allows("export");

    return html`
      <jolly-button
        icon="search"
        icon-only
        label="Search"
        title="Search (opens the console)"
        @click=${this.#search}
      ></jolly-button>
      <jolly-button
        icon="export"
        icon-only
        label="Export"
        title=${user?.online ? "Export" : "Export needs the studio server"}
        ?disabled=${this._exporting || !canExport}
        @click=${this.#export}
      ></jolly-button>
      <jolly-button
        icon="settings"
        icon-only
        label="Settings"
        title="Settings"
        @click=${this.#openSettings}
      ></jolly-button>
      ${this.#golemButton(this.agentChat)}
    `;
  }

  #golemButton(
    chat: StudioAgentChat | null
  ): TemplateResult | typeof nothing {
    if (chat === null) {
      return nothing;
    }

    const label = chat.visible ?
      "Close the golem chat" :
      "Open the golem chat";

    return html`
      <jolly-button
        icon="chat"
        icon-only
        label=${label}
        title=${label}
        ?data-open=${chat.visible}
        @click=${this.#toggleGolemChat}
      ></jolly-button>
    `;
  }

  readonly #search = (): void => {
    this.dispatchEvent(new Event("console-toggle"));
  };

  readonly #openSettings = (): void => {
    this.dispatchEvent(new SettingsOpenEvent());
  };

  readonly #toggleGolemChat = (): void => {
    this.dispatchEvent(new Event("golem-chat-toggle"));
  };

  readonly #export = async(): Promise<void> => {
    const user = this.#user.current;
    if (!user?.online || this._exporting) {
      return;
    }

    const target = await askExport(this.play?.defaultScene ?? null);
    if (target === null) {
      return;
    }

    this._exporting = true;
    try {
      const download = await exportFile(user, target);
      download.save();
    }
    catch (error) {
      this.dispatchEvent(
        StudioErrorEvent.from(error, `Could not export the ${target}`)
      );
    }
    finally {
      this._exporting = false;
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-header-actions": HeaderActions;
  }

  interface HTMLElementEventMap {
    "console-toggle": Event;
    "golem-chat-toggle": Event;
  }
}
