// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import type { Account } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import { BrowserState } from "../../browser/BrowserState.ts";
import { StudioErrorEvent } from "../StudioErrorEvent.ts";
import type { AssetBrowserOptions } from "../assets/AssetBrowser.ts";
import type { EditorTab } from "../../tabs/EditorTabs.ts";
import "../assets/AssetBrowser.ts";
import "./ProjectOverview.ts";
import "../users/UsersPane.ts";
import "../shares/ShareLinksPane.ts";

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
  declare signedIn: StudioSignedIn | null;

  @property({ attribute: false })
  declare account: Account | null;

  @property({ attribute: false })
  declare browserState: BrowserState;

  @state()
  declare _exporting: boolean;

  @state()
  declare _canExport: boolean;

  constructor() {
    super();
    this.assets = null;
    this.openTabs = [];
    this.signedIn = null;
    this.account = null;
    this.browserState = new BrowserState();
    this._exporting = false;
    this._canExport = false;
  }

  override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("signedIn") || changed.has("account")) {
      void this.#loadExportRight();
    }
  }

  override render(): TemplateResult {
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
        ${this.signedIn === null ? nothing : this.#usersDock(this.signedIn)}
      </jolly-dock-layout>
    `;
  }

  #usersDock(
    signedIn: StudioSignedIn
  ): TemplateResult {
    const users = html`
      <jolly-pane key="users" heading="Users" icon="users" locked>
        <studio-users
          .roster=${signedIn.roster}
          .self=${this.account}
        ></studio-users>
      </jolly-pane>
    `;

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
            title="Export project"
            ?disabled=${this._exporting || !this._canExport}
            @click=${this.#export}
          ></jolly-button>
        </jolly-toolbar>
        ${this.assets === null ? users : html`
          <jolly-pane-group active="users">
            ${users}
            <jolly-pane
              key="share-links"
              heading="Share links"
              icon="share"
              locked
            >
              <studio-share-links
                .links=${signedIn.shares}
                .catalog=${this.assets.catalog}
              ></studio-share-links>
            </jolly-pane>
          </jolly-pane-group>
        `}
      </jolly-dock>
    `;
  }

  async #loadExportRight(): Promise<void> {
    const signedIn = this.signedIn;
    this._canExport = false;
    if (signedIn === null) {
      return;
    }

    try {
      const canExport = await signedIn.projectArchive.canExport();
      if (this.signedIn === signedIn) {
        this._canExport = canExport;
      }
    }
    catch (error) {
      this.dispatchEvent(
        StudioErrorEvent.from(error, "Could not check the export right")
      );
    }
  }

  readonly #openSettings = (): void => {
    this.dispatchEvent(new Event("settings-open", {
      bubbles: true,
      composed: true
    }));
  };

  readonly #export = async(): Promise<void> => {
    if (this.signedIn === null || this._exporting) {
      return;
    }

    this._exporting = true;
    try {
      const download = await this.signedIn.projectArchive.download();
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
