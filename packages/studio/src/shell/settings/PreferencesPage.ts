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
import type {
  PreferenceScope,
  Preferences
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import "./KeybindingSettings.ts";
import "./PreferenceForm.ts";

@customElement("studio-preferences-page")
export class PreferencesPage extends LitElement {
  static override styles = css`
    :host {
      display: block;
      container-type: inline-size;
    }

    .columns {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-4);
      max-width: var(--studio-settings-column, 640px);
    }

    .column {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-4);
      min-width: 0;
    }

    @container (min-width: 54rem) {
      .columns.split {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        align-items: start;
        max-width: none;
      }
    }
  `;

  @property({ attribute: false })
  declare forms: readonly PreferenceScope[];

  @property({ attribute: false })
  declare keyBindings: readonly PreferenceScope[];

  @property({ attribute: false })
  declare preferences: Preferences | null;

  constructor() {
    super();
    this.forms = [];
    this.keyBindings = [];
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
