// Import Third-party Dependencies
import {
  LitElement,
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
import type { Preferences } from "@jolly-pixel/editor.host/preferences";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/toolbar";

// Import Internal Dependencies
import type { PreferenceScopes } from "../../../shared/PreferenceScopes.ts";
import { PreferencesFile } from "../../preferences/PreferencesFile.ts";
import { settingsStyles } from "./settingsStyles.ts";

@customElement("studio-preferences-transfer")
export class PreferencesTransfer extends LitElement {
  static override styles = settingsStyles;

  @property({ attribute: false })
  declare preferences: Preferences | null;

  @property({ attribute: false })
  declare scopes: PreferenceScopes | null;

  @state()
  declare _status: TemplateResult | typeof nothing;

  @query("input[type=file]")
  declare _picker: HTMLInputElement | null;

  constructor() {
    super();
    this.preferences = null;
    this.scopes = null;
    this._status = nothing;
  }

  override render(): TemplateResult {
    const ready = this.preferences !== null && this.scopes !== null;

    return html`
      <jolly-toolbar label="Preferences file">
        <jolly-button
          data-action="export-preferences"
          title="Saves every preference and shortcut to a JSON file"
          ?disabled=${!ready}
          @click=${this.#export}
        >Export preferences</jolly-button>
        <jolly-button
          data-action="import-preferences"
          title="Replaces the preferences and shortcuts the file holds"
          ?disabled=${!ready}
          @click=${this.#pick}
        >Import preferences…</jolly-button>
      </jolly-toolbar>
      <input
        type="file"
        accept=".json,application/json"
        hidden
        @change=${this.#onPick}
      />
      ${this._status}
    `;
  }

  readonly #export = (): void => {
    if (this.preferences !== null && this.scopes !== null) {
      PreferencesFile.export(this.preferences, this.scopes).toDownload().save();
    }
  };

  readonly #pick = (): void => {
    this._picker?.click();
  };

  readonly #onPick = async(): Promise<void> => {
    const file = this._picker?.files?.[0];
    if (this._picker !== null) {
      this._picker.value = "";
    }
    if (file === undefined || this.preferences === null || this.scopes === null) {
      return;
    }

    try {
      const imported = await PreferencesFile.read(file, this.scopes);
      imported.applyTo(this.preferences);
      this._status = html`<p role="status">${imported.size === 0 ?
        "The file holds no preferences this project knows." :
        `Preferences imported from "${file.name}".`}</p>`;
    }
    catch (error) {
      this._status = html`<p class="error" role="alert">
        Preferences not imported: ${error instanceof Error ? error.message : String(error)}
      </p>`;
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-preferences-transfer": PreferencesTransfer;
  }
}
