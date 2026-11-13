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
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/separator";
import "@jolly-pixel/ui/elements/vector2";
import type {
  KindOptionField,
  KindOptionGroup,
  KindOptionSection,
  KindOptionVector2,
  KindPackageSettings
} from "@jolly-pixel/server";

// Import Internal Dependencies
import type { KindOptionsDraft } from "../../../project/KindOptionsDraft.ts";
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsEditEvent } from "../SettingsEditEvent.ts";

@customElement("studio-project-kind-package")
export class ProjectKindPackage extends LitElement {
  static override styles = settingsStyles;

  @property({ attribute: false })
  declare settings: KindPackageSettings | null;

  @property({ attribute: false })
  declare value: KindOptionsDraft | null;

  @property({ type: Boolean })
  declare disabled: boolean;

  constructor() {
    super();
    this.settings = null;
    this.value = null;
    this.disabled = false;
  }

  override render(): TemplateResult | typeof nothing {
    const { settings, value } = this;
    if (settings === null || value === null) {
      return nothing;
    }

    return html`
      ${settings.sections.map(
        (section) => this.#section(settings.name, value, section)
      )}
    `;
  }

  #section(
    packageName: string,
    value: KindOptionsDraft,
    section: KindOptionSection
  ): TemplateResult {
    return html`
      <section aria-label=${section.label ?? nothing}>
        ${section.label === null ? nothing : html`
          <jolly-separator label=${section.label}></jolly-separator>
        `}
        ${section.fields.map((field) => this.#field(packageName, value, field))}
        ${section.groups.map((group) => this.#group(packageName, value, group))}
      </section>
    `;
  }

  #group(
    packageName: string,
    value: KindOptionsDraft,
    group: KindOptionGroup
  ): TemplateResult {
    const key = `${packageName}:${group.path.join(".")}`;

    return html`
      <jolly-folder
        data-option-group=${key}
        storage-key=${`studio-kind-options:${key}`}
        label=${group.label}
        flush
        .open=${false}
      >
        ${group.fields.map((field) => this.#field(packageName, value, field))}
      </jolly-folder>
    `;
  }

  #field(
    packageName: string,
    value: KindOptionsDraft,
    field: KindOptionField
  ): TemplateResult {
    const option = `${packageName}:${field.path.join(".")}`;
    const min = field.min ?? -Infinity;
    const max = field.max ?? Infinity;

    if (field.type === "vector2") {
      return html`
        <jolly-vector2
          data-option=${option}
          label=${field.label}
          label-position="top"
          .min=${min}
          .max=${max}
          .step=${1}
          .value=${value.value(packageName, field) ?? field.default}
          .default=${field.default}
          ?readonly=${this.disabled}
          @jolly-change=${(event: CustomEvent<{ value: KindOptionVector2; }>) => {
            this.#edit(value.with(packageName, field, event.detail.value));
          }}
        ></jolly-vector2>
      `;
    }

    return html`
      <jolly-number
        data-option=${option}
        label=${field.label}
        label-position="top"
        .min=${min}
        .max=${max}
        .step=${1}
        .value=${value.value(packageName, field) ?? field.default}
        .default=${field.default}
        ?readonly=${this.disabled}
        @jolly-change=${(event: CustomEvent<{ value: number; }>) => {
          this.#edit(value.with(packageName, field, event.detail.value));
        }}
      ></jolly-number>
    `;
  }

  #edit(
    kinds: KindOptionsDraft
  ): void {
    this.dispatchEvent(new SettingsEditEvent("kinds", kinds));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-kind-package": ProjectKindPackage;
  }
}
