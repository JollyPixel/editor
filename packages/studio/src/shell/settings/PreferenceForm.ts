// Import Third-party Dependencies
import {
  LitElement,
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
import type {
  FormPreference,
  PreferenceScope,
  Preferences
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { settingsStyles } from "./settingsStyles.ts";

@customElement("studio-preference-form")
export class PreferenceForm extends LitElement {
  static override styles = settingsStyles;

  @property({ attribute: false })
  declare scope: PreferenceScope | null;

  @property({ attribute: false })
  declare preferences: Preferences | null;

  @state()
  declare _version: number;

  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.scope = null;
    this.preferences = null;
    this._version = 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#watch();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("scope") || changed.has("preferences")) {
      this.#watch();
    }
  }

  override render(): TemplateResult | typeof nothing {
    const { scope, preferences } = this;
    if (scope === null || preferences === null) {
      return nothing;
    }

    const values: Readonly<Record<string, unknown>> = preferences.values(scope);

    return html`${scope.form.map((group) => html`
      <section>
        ${group.label === null ? nothing : html`
          <jolly-separator label=${group.label}></jolly-separator>
        `}
        ${group.fields.map(([key, field]) => this.#field(key, field, values[key]))}
      </section>
    `)}`;
  }

  #watch(): void {
    this.#unwatch?.();
    this.#unwatch = this.scope === null || this.preferences === null ?
      null :
      this.preferences.watch(this.scope, () => {
        this._version++;
      });
  }

  #field(
    key: string,
    field: FormPreference,
    value: unknown
  ): TemplateResult {
    const onChange = (event: CustomEvent<{ value: unknown; }>): void => {
      this.#assign(key, event.detail.value);
    };

    switch (field.type) {
      case "boolean":
        return html`
          <jolly-checkbox
            data-preference=${key}
            label=${field.label}
            description=${field.description ?? ""}
            description-display="tooltip"
            .value=${value}
            .default=${field.default}
            @jolly-change=${onChange}
          ></jolly-checkbox>
        `;
      case "enum":
        return html`
          <jolly-select
            data-preference=${key}
            label=${field.label}
            description=${field.description ?? ""}
            description-display="tooltip"
            .options=${field.options}
            .value=${value}
            .default=${field.default}
            @jolly-change=${onChange}
          ></jolly-select>
        `;
      case "range":
        return html`
          <jolly-slider
            data-preference=${key}
            label=${field.label}
            description=${field.description ?? ""}
            description-display="tooltip"
            .min=${field.min}
            .max=${field.max}
            .step=${field.step ?? 1}
            .value=${value}
            .default=${field.default}
            @jolly-change=${onChange}
          ></jolly-slider>
        `;
      case "color":
        return html`
          <jolly-color
            data-preference=${key}
            label=${field.label}
            description=${field.description ?? ""}
            description-display="tooltip"
            .value=${value ?? ""}
            .default=${field.default ?? ""}
            @jolly-change=${(event: CustomEvent<{ value: string; }>) => {
              this.#assign(key, event.detail.value === "" ? null : event.detail.value);
            }}
          ></jolly-color>
        `;
      case "entries":
        return html`
          <jolly-property-row
            label=${field.label}
            description=${field.description ?? ""}
            description-display="tooltip"
          >
            <jolly-button
              data-preference=${key}
              ?disabled=${Object.keys(value ?? {}).length === 0}
              @click=${() => this.#reset(key)}
            >Clear</jolly-button>
          </jolly-property-row>
        `;
      default:
        return field satisfies never;
    }
  }

  #assign(
    key: string,
    value: unknown
  ): void {
    if (this.scope !== null) {
      this.preferences?.assign(this.scope, key, value);
    }
  }

  #reset(
    key: string
  ): void {
    if (this.scope !== null) {
      this.preferences?.reset(this.scope, key);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-preference-form": PreferenceForm;
  }
}
