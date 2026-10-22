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

// Import Internal Dependencies
import { KindOptionsDraft } from "../../../project/KindOptionsDraft.ts";
import type { StudioProjectSettings } from "../../../project/StudioProjectSettings.ts";
import type {
  KindOptionField,
  KindOptionGroup,
  KindOptionSection,
  KindOptionValue,
  KindOptionVector2
} from "../../../../shared/api/project.ts";
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsDraftController } from "./SettingsDraftController.ts";

interface KindOptionForm {
  draft: KindOptionsDraft;
  readonly: boolean;
}

@customElement("studio-project-kind-package")
export class ProjectKindPackage extends LitElement {
  static override styles = [settingsStyles, css`
    pre {
      margin: 0;
      padding: var(--jolly-space-2);
      border-radius: var(--jolly-radius-sm);
      background: var(--jolly-surface-sunken);
      font-size: 0.9em;
      white-space: pre-wrap;
    }
  `];

  #draft = new SettingsDraftController(this, {
    saved: (data) => KindOptionsDraft.from(data.kinds),
    save: (project, draft) => project.replaceKinds(draft.toJSON())
  });
  @property({ attribute: false })
  declare packageName: string;

  constructor() {
    super();
    this.packageName = "";
  }

  set project(
    project: StudioProjectSettings
  ) {
    this.#draft.attach(project);
  }

  override render(): TemplateResult | typeof nothing {
    const { project } = this.#draft;
    const kindPackage = project?.data?.kinds.find(
      (candidate) => candidate.name === this.packageName
    );
    const { draft } = this.#draft;
    if (project === null || kindPackage === undefined || draft === null) {
      return this.#draft.error();
    }

    const form: KindOptionForm = {
      draft,
      readonly: !project.canEdit
    };

    return html`
      ${this.#draft.error()}
      ${kindPackage.sections.length === 0 ?
        html`<pre>${JSON.stringify(kindPackage.options, null, 2)}</pre>` :
        kindPackage.sections.map((section) => this.#section(form, section))}
      ${form.readonly ? nothing : this.#draft.actions("Kind option actions")}
    `;
  }

  #section(
    form: KindOptionForm,
    section: KindOptionSection
  ): TemplateResult {
    return html`
      <section aria-label=${section.label ?? nothing}>
        ${section.label === null ? nothing : html`
          <jolly-separator label=${section.label}></jolly-separator>
        `}
        ${section.fields.map((field) => this.#field(form, field))}
        ${section.groups.map((group) => this.#group(form, group))}
      </section>
    `;
  }

  #group(
    form: KindOptionForm,
    group: KindOptionGroup
  ): TemplateResult {
    const key = `${this.packageName}:${group.path.join(".")}`;

    return html`
      <jolly-folder
        data-option-group=${key}
        storage-key=${`studio-kind-options:${key}`}
        label=${group.label}
        flush
        .open=${false}
      >
        ${group.fields.map((field) => this.#field(form, field))}
      </jolly-folder>
    `;
  }

  #field(
    form: KindOptionForm,
    field: KindOptionField
  ): TemplateResult {
    const option = `${this.packageName}:${field.path.join(".")}`;
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
          .value=${form.draft.value(this.packageName, field) ?? field.default}
          .default=${field.default}
          ?readonly=${form.readonly}
          @jolly-change=${(event: CustomEvent<{ value: KindOptionVector2; }>) => {
            this.#edit(form, field, event.detail.value);
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
        .value=${form.draft.value(this.packageName, field) ?? field.default}
        .default=${field.default}
        ?readonly=${form.readonly}
        @jolly-change=${(event: CustomEvent<{ value: number; }>) => {
          this.#edit(form, field, event.detail.value);
        }}
      ></jolly-number>
    `;
  }

  #edit<TField extends KindOptionField>(
    form: KindOptionForm,
    field: TField,
    value: KindOptionValue<TField>
  ): void {
    this.#draft.edit(form.draft.with(this.packageName, field, value));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-kind-package": ProjectKindPackage;
  }
}
