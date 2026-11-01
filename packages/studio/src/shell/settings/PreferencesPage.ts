// Import Third-party Dependencies
import type { Preferences, PreferenceScope } from "@jolly-pixel/preferences";
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

// Import Internal Dependencies
import { settingsColumnsStyles } from "./settingsStyles.ts";
import "./KeybindingSettings.ts";
import "./PreferenceForm.ts";

@customElement("studio-preferences-page")
export class PreferencesPage extends LitElement {
  static override styles = [settingsColumnsStyles, css`
    :host {
      display: block;
    }

    .column {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-4);
      min-width: 0;
    }
  `];

  @property({ attribute: false })
  declare forms: readonly PreferenceScope[];

  @property({ attribute: false })
  declare keyBindings: readonly PreferenceScope[];

  @property({ attribute: false })
  declare shortcutScopes: readonly PreferenceScope[];

  @property({ attribute: false })
  declare preferences: Preferences | null;

  constructor() {
    super();
    this.forms = [];
    this.keyBindings = [];
    this.shortcutScopes = [];
    this.preferences = null;
  }

  override render(): TemplateResult {
    const split = this.forms.length > 0 && this.keyBindings.length > 0;

    return html`
      <div class="columns ${split ? "split" : ""}">
        ${this.forms.length === 0 ? nothing : html`
          <div class="column" data-column="preferences">
            ${this.forms.map((scope) => html`
              <studio-preference-form
                .scope=${scope}
                .preferences=${this.preferences}
              ></studio-preference-form>
            `)}
          </div>
        `}
        ${this.keyBindings.length === 0 ? nothing : html`
          <div class="column" data-column="shortcuts">
            <studio-keybinding-settings
              .scopes=${this.keyBindings}
              .shortcutScopes=${this.shortcutScopes}
              .preferences=${this.preferences}
            ></studio-keybinding-settings>
          </div>
        `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-preferences-page": PreferencesPage;
  }
}
