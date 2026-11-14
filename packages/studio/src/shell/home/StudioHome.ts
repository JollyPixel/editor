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
  property
} from "lit/decorators.js";
import "@jolly-pixel/ui/elements/dock";
import "@jolly-pixel/ui/elements/dock-layout";
import "@jolly-pixel/ui/elements/pane";

// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import {
  STUDIO_USER_CHANGE,
  type StudioUser
} from "../../accounts/StudioUser.ts";
import { BrowserState } from "../../browser/BrowserState.ts";
import type { StudioAgentChat } from "../../golem/StudioAgentChat.ts";
import { ChangeController } from "../ChangeController.ts";
import type { AssetBrowserOptions } from "../assets/AssetBrowser.ts";
import "../assets/AssetBrowser.ts";
import "./ProjectReadme.ts";
import "../users/UsersPane.ts";

// CONSTANTS
export const HOME_LAYOUT_STORAGE_KEY = "studio:home-layout";

@customElement("studio-home")
export class StudioHome extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 100%;
    }

    :host([hidden]) {
      display: none;
    }

    jolly-dock {
      background: transparent;

      --jolly-dock-handle-size: var(--studio-gutter);
      --jolly-dock-resize-bg: transparent;
      --jolly-dock-resize-bg-hover: transparent;
    }

    jolly-dock::part(resize-handle)::after {
      display: none;
    }

    #asset-dock jolly-pane {
      background: transparent;
    }

    #asset-dock jolly-pane::part(header) {
      display: none;
    }

    jolly-pane::part(content) {
      padding: 0;
    }

    #users-dock > :is(jolly-pane, jolly-pane-group) {
      overflow: hidden;
      border-radius: var(--studio-radius);
      background: var(--studio-card);
      box-shadow: var(--studio-bevel);
    }

    #users-dock jolly-pane {
      --jolly-header-texture-color: var(--jolly-ink);
      --jolly-header-texture-opacity: 0.04;

      background: transparent;
    }

    #users-dock jolly-pane::part(header),
    #users-dock jolly-pane-group::part(tabs) {
      box-sizing: border-box;
      min-height: var(--studio-card-head-height);
      background: transparent;
      color: var(--jolly-text-muted);
    }

    #users-dock jolly-pane::part(header) {
      padding: 0 var(--jolly-space-3);
    }

    #users-dock jolly-pane-group::part(tabs) {
      padding-inline: var(--jolly-space-1);
    }

    #users-dock jolly-pane-group::part(tab) {
      letter-spacing: normal;
    }

    #users-dock jolly-pane-group::part(tab):hover {
      background: var(--jolly-control-bg-hover);
      color: var(--jolly-text);
    }

    #users-dock jolly-pane-group::part(tab-selected),
    #users-dock jolly-pane-group::part(tab-selected):hover {
      background: transparent;
      color: var(--jolly-accent-text);
    }
  `;

  @property({ attribute: false })
  declare assets: AssetBrowserOptions | null;

  @property({ attribute: false })
  declare browserState: BrowserState;

  @property({ attribute: false })
  declare agentChat: StudioAgentChat | null;

  #user = new ChangeController<StudioUser>(this, STUDIO_USER_CHANGE);

  constructor() {
    super();
    this.assets = null;
    this.agentChat = null;
    this.browserState = new BrowserState();
  }

  set user(
    user: StudioUser | null
  ) {
    if (user !== null) {
      this.#user.attach(user);
    }
  }

  override render(): TemplateResult {
    const user = this.#user.current;

    return html`
      <jolly-dock-layout
        storage-key=${HOME_LAYOUT_STORAGE_KEY}
        .storage=${this.browserState.storage}
      >
        <jolly-dock
          id="asset-dock"
          key="left"
          side="left"
          drop="none"
          size="280"
          min-size="200"
          max-size="480"
        >
          <jolly-pane key="assets" heading="Assets" locked>
            <asset-browser .options=${this.assets}></asset-browser>
          </jolly-pane>
        </jolly-dock>
        <project-readme .options=${this.assets}></project-readme>
        ${user?.online && this.agentChat !== null ?
          this.#usersDock(user, this.agentChat) :
          nothing}
      </jolly-dock-layout>
    `;
  }

  #usersDock(
    user: StudioSignedIn,
    agentChat: StudioAgentChat
  ): TemplateResult {
    return html`
      <jolly-dock
        id="users-dock"
        key="right"
        side="right"
        drop="none"
        size="240"
        min-size="180"
        max-size="400"
      >
        <jolly-pane key="users" heading="Users" icon="users" locked>
          <studio-users
            .roster=${user.roster}
            .self=${user.account}
            .agentChat=${agentChat}
          ></studio-users>
        </jolly-pane>
      </jolly-dock>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-home": StudioHome;
  }
}
