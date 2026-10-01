// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import type { AssetBrowserOptions } from "../assets/AssetBrowser.ts";
import type { EditorTab } from "../../tabs/EditorTabs.ts";
import "../assets/AssetBrowser.ts";
import "./ProjectOverview.ts";

// CONSTANTS
export const HOME_LAYOUT_STORAGE_KEY = "studio:home-layout";

@customElement("studio-home")
export class StudioHome extends LitElement {
  @property({ attribute: false })
  declare assets: AssetBrowserOptions | null;

  @property({ attribute: false })
  declare openTabs: readonly EditorTab[];

  constructor() {
    super();
    this.assets = null;
    this.openTabs = [];
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
      </jolly-dock-layout>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-home": StudioHome;
  }
}
