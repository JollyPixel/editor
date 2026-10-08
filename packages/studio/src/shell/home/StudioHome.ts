// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import type { AssetBrowserOptions } from "../assets/AssetBrowser.ts";
import type { EditorTab } from "../../tabs/EditorTabs.ts";
import "../assets/AssetBrowser.ts";
import "./ProjectOverview.ts";
import "../users/UsersPane.ts";

// CONSTANTS
export const HOME_LAYOUT_STORAGE_KEY = "studio:home-layout";

@customElement("studio-home")
export class StudioHome extends LitElement {
  @property({ attribute: false })
  declare assets: AssetBrowserOptions | null;

  @property({ attribute: false })
  declare openTabs: readonly EditorTab[];

  @property({ attribute: false })
  declare signedIn: StudioSignedIn | null;

  constructor() {
    super();
    this.assets = null;
    this.openTabs = [];
    this.signedIn = null;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult {
    return html`
      <jolly-dock-layout storage-key=${HOME_LAYOUT_STORAGE_KEY}>
        <jolly-dock
          id="asset-dock"
          key="left"
          side="left"
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
        ${this.signedIn === null ? nothing : html`
          <jolly-dock
            id="users-dock"
            key="right"
            side="right"
            size="240"
            min-size="180"
            max-size="400"
          >
            <jolly-pane key="users" heading="Users" locked>
              <studio-users
                .roster=${this.signedIn.roster}
                .self=${this.signedIn.account}
              ></studio-users>
            </jolly-pane>
          </jolly-dock>
        `}
      </jolly-dock-layout>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-home": StudioHome;
  }
}
