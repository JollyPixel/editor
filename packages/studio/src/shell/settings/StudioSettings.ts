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
import type { Account } from "@jolly-pixel/accounts";
import type { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { cardStyles } from "../cardStyles.ts";
import {
  SettingsSections,
  type SettingsSection,
  type SettingsTier
} from "./SettingsSections.ts";
import "./KeybindingSettings.ts";
import "./PreferenceForm.ts";
import "./ProfileSettings.ts";

// CONSTANTS
export const SETTINGS_TAB_ID = "studio:settings";
const kTierLabels: Record<SettingsTier, string> = {
  you: "You",
  project: "Project"
};

@customElement("studio-settings")
export class StudioSettings extends LitElement {
  static override styles = [cardStyles, css`
    :host {
      display: flex;
      gap: var(--studio-gutter);
      width: 100%;
      height: 100%;
    }

    :host([hidden]) {
      display: none;
    }

    nav {
      display: flex;
      flex: 0 0 200px;
      flex-direction: column;
      gap: var(--jolly-space-1);
      padding: var(--jolly-space-2);
    }

    nav h2 {
      margin: var(--jolly-space-2) 0 0;
      padding-inline: var(--jolly-space-2);
      color: var(--jolly-text-muted);
      font-size: 0.85em;
      font-weight: 600;
      text-transform: uppercase;
    }

    nav button {
      padding: var(--jolly-space-1) var(--jolly-space-2);
      border: 0;
      border-radius: var(--jolly-radius-sm);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }

    nav button:hover {
      background: var(--jolly-control-bg-hover);
    }

    nav button[aria-current="page"] {
      background: var(--jolly-control-bg-active);
      font-weight: 600;
    }

    .card {
      flex: 1 1 auto;
    }

    .card-body {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-4);
      max-width: 640px;
    }
  `];

  @property({ attribute: false })
  declare sections: SettingsSections;

  @property({ attribute: false })
  declare preferences: Preferences | null;

  @property({ attribute: false })
  declare account: Account | null;

  @property()
  declare section: string;

  constructor() {
    super();
    this.sections = SettingsSections.EMPTY;
    this.preferences = null;
    this.account = null;
    this.section = "";
  }

  override render(): TemplateResult {
    const current = this.sections.find(this.section) ?? this.sections.first;

    return html`
      <nav class="card" aria-label="Settings sections">
        ${this.#tier("you", current)}
        ${this.#tier("project", current)}
      </nav>
      <section class="card" aria-label=${current?.label ?? "Settings"}>
        <header class="card-head">
          <h2 class="card-title">${current?.label ?? ""}</h2>
        </header>
        <div class="card-body">
          ${current === undefined ? nothing : this.#content(current)}
        </div>
      </section>
    `;
  }

  #tier(
    tier: SettingsTier,
    current: SettingsSection | undefined
  ): TemplateResult | typeof nothing {
    const sections = this.sections.inTier(tier);
    if (sections.length === 0) {
      return nothing;
    }

    return html`
      <h2>${kTierLabels[tier]}</h2>
      ${sections.map((section) => html`
        <button
          type="button"
          data-section=${section.id}
          aria-current=${section === current ? "page" : "false"}
          @click=${() => {
            this.section = section.id;
          }}
        >${section.label}</button>
      `)}
    `;
  }

  #content(
    section: SettingsSection
  ): TemplateResult {
    if (section.kind === "profile") {
      return html`
        <studio-profile-settings
          .account=${this.account}
        ></studio-profile-settings>
      `;
    }

    if (section.kind === "keybindings") {
      return html`
        <studio-keybinding-settings
          .scopes=${section.scopes}
          .preferences=${this.preferences}
        ></studio-keybinding-settings>
      `;
    }

    return html`${section.scopes.map((scope) => html`
      <studio-preference-form
        .scope=${scope}
        .preferences=${this.preferences}
      ></studio-preference-form>
    `)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-settings": StudioSettings;
  }
}
