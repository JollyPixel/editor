// Import Third-party Dependencies
import {
  html,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import {
  COLOR_PICKER_OPTIONS,
  type ColorPickerChoice,
  type ColorPickerPreferences
} from "./preferences.ts";
import { isInputElement } from "../dom.ts";
import "../icon/Icon.ts";

export interface PickerSettingsOptions {
  preferences(): ColorPickerPreferences;
  configure(patch: Partial<ColorPickerPreferences>): void;
}

export class PickerSettings {
  readonly #host: ReactiveControllerHost;
  readonly #options: PickerSettingsOptions;
  #open = false;

  constructor(
    host: ReactiveControllerHost,
    options: PickerSettingsOptions
  ) {
    this.#host = host;
    this.#options = options;
  }

  get open(): boolean {
    return this.#open;
  }

  renderToggle(): TemplateResult {
    return html`
      <button
        class="settings-toggle"
        type="button"
        title="Picker settings"
        aria-label="Picker settings"
        aria-expanded=${String(this.#open)}
        @click=${this.#toggle}
      ><jolly-icon name="settings"></jolly-icon></button>
    `;
  }

  renderPanel(): TemplateResult {
    const preferences = this.#options.preferences();

    return html`
      <div class="settings" role="group" aria-label="Picker settings">
        ${this.#renderSelect("Space", "space", preferences)}
        ${this.#renderSelect("Selector", "selector", preferences)}
        ${this.#renderSelect("Channels", "channels", preferences)}
        ${this.#renderSelect("Harmony", "harmony", preferences)}
        <label class="setting-check">
          <input
            type="checkbox"
            .checked=${preferences.discrete}
            @change=${(event: Event) => {
              if (isInputElement(event.target)) {
                this.#options.configure({ discrete: event.target.checked });
              }
            }}
          >
          <span>Discrete wheel</span>
        </label>
      </div>
    `;
  }

  #renderSelect(
    label: string,
    key: ColorPickerChoice,
    preferences: ColorPickerPreferences
  ): TemplateResult {
    const options = COLOR_PICKER_OPTIONS[key];

    return html`
      <label class="setting">
        <span class="setting-name">${label}</span>
        <select
          class="setting-select"
          @change=${(event: Event) => {
            const target = event.target;
            const picked = options.find(({ value }) => (
              target instanceof HTMLSelectElement && value === target.value
            ));
            if (picked !== undefined) {
              this.#options.configure({ [key]: picked.value });
            }
          }}
        >
          ${options.map(({ value, label: text }) => html`
            <option value=${value} ?selected=${value === preferences[key]}>${text}</option>
          `)}
        </select>
      </label>
    `;
  }

  readonly #toggle = (): void => {
    this.#open = !this.#open;
    this.#host.requestUpdate();
  };
}
