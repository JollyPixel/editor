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
import "@jolly-pixel/ui/elements/dock";
import "@jolly-pixel/ui/elements/dock-layout";
import "@jolly-pixel/ui/elements/pane";
import "@jolly-pixel/ui/elements/toolbar";

// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import {
  STUDIO_USER_CHANGE,
  type StudioUser
} from "../../accounts/StudioUser.ts";
import { BrowserState } from "../../browser/BrowserState.ts";
import { ChangeController } from "../ChangeController.ts";
import { StudioErrorEvent } from "../StudioErrorEvent.ts";
import type { AssetBrowserOptions } from "../assets/AssetBrowser.ts";
import type { EditorTab } from "../../tabs/EditorTabs.ts";
import "../assets/AssetBrowser.ts";
import "./ProjectOverview.ts";
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

    #studio-side {
      display: flex;
      flex: 0 0 240px;
      flex-direction: column;
      margin-inline-start: var(--studio-gutter);
    }

    #studio-tools {
      flex: 0 0 auto;
      margin-block-end: var(--studio-gutter);

      --jolly-control-height: var(--studio-card-head-height);
      --jolly-icon-size: 18px;
    }

    #studio-tools jolly-button {
      flex: 1 1 0;
      border-radius: var(--studio-radius);
      background: var(--studio-card);
      box-shadow: var(--studio-bevel);

      --jolly-icon-button-size: 100%;
      --jolly-control-bg: transparent;
      --jolly-control-bg-hover: color-mix(
        in oklab,
        var(--jolly-ink) 8%,
        transparent
      );
    }

    #users-dock > :is(jolly-pane, jolly-pane-group) {
      overflow: hidden;
      border-radius: var(--studio-radius);
      background: var(--studio-card);
      box-shadow: var(--studio-bevel);
    }

    #users-dock jolly-pane {
      background: transparent;
    }

    #users-dock jolly-pane::part(header),
    #users-dock jolly-pane-group::part(tabs) {
      min-height: var(--studio-card-head-height);
      padding-inline: var(--jolly-space-1);
      background: transparent;
      color: var(--jolly-text-muted);
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
  declare openTabs: readonly EditorTab[];

  @property({ attribute: false })
  declare browserState: BrowserState;

  @state()
  declare _exporting: boolean;

  #user = new ChangeController<StudioUser>(this, STUDIO_USER_CHANGE);

  constructor() {
    super();
    this.assets = null;
    this.openTabs = [];
    this.browserState = new BrowserState();
    this._exporting = false;
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
        <project-overview
          .options=${this.assets}
          .openTabs=${this.openTabs}
        ></project-overview>
        ${user?.online ? this.#usersDock(user) : nothing}
      </jolly-dock-layout>
      ${user?.online ?
        nothing :
        html`<div id="studio-side">${this.#tools(user)}</div>`}
    `;
  }

  #usersDock(
    user: StudioSignedIn
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
        ${this.#tools(user)}
        <jolly-pane key="users" heading="Users" icon="users" locked>
          <studio-users
            .roster=${user.roster}
            .self=${user.account}
          ></studio-users>
        </jolly-pane>
      </jolly-dock>
    `;
  }

  #tools(
    user: StudioUser | null
  ): TemplateResult {
    const canExport = user?.rights.allows("export") ?? false;

    return html`
      <jolly-toolbar id="studio-tools" label="Studio tools">
        <jolly-button
          icon="settings"
          icon-only
          label="Settings"
          title="Settings"
          @click=${this.#openSettings}
        ></jolly-button>
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
          label="Export project"
          title=${user?.online ?
            "Export project" :
            "Export needs the studio server"}
          ?disabled=${this._exporting || !canExport}
          @click=${this.#export}
        ></jolly-button>
      </jolly-toolbar>
    `;
  }

  readonly #openSettings = (): void => {
    this.dispatchEvent(new Event("settings-open", {
      bubbles: true,
      composed: true
    }));
  };

  readonly #export = async(): Promise<void> => {
    const user = this.#user.current;
    if (!user?.online || this._exporting) {
      return;
    }

    this._exporting = true;
    try {
      const download = await user.exportProject();
      download.save();
    }
    catch (error) {
      this.dispatchEvent(
        StudioErrorEvent.from(error, "Could not export the project")
      );
    }
    finally {
      this._exporting = false;
    }
  };

  readonly #search = (): void => {
    this.dispatchEvent(new Event("console-toggle", {
      bubbles: true,
      composed: true
    }));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-home": StudioHome;
  }

  interface HTMLElementEventMap {
    "console-toggle": Event;
    "settings-open": Event;
  }
}
