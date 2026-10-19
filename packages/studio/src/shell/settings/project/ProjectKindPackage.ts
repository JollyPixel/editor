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
  KindPackageSettings
} from "../../../project/routes.ts";
import { settingsStyles } from "../settingsStyles.ts";
import { ProjectSettingsController } from "./ProjectSettingsController.ts";
import { SettingsDraftController } from "./SettingsDraftController.ts";

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

  #project = new ProjectSettingsController(this);
  #draft = new SettingsDraftController(this, {
    project: this.#project,
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
    this.#draft.reset();
    this.#project.attach(project);
  }

  override render(): TemplateResult | typeof nothing {
    const project = this.#project.current;
    const kindPackage = project?.data?.kinds.find(
      (candidate) => candidate.name === this.packageName
    );
    const draft = this.#draft.current;
    if (project === null || kindPackage === undefined || draft === null) {
      return this.#project.error();
    }

    const readonly = !project.canEdit;

    return html`
      ${this.#project.error()}
      <section data-kind-package=${kindPackage.name}>
        ${kindPackage.fields.length === 0 ?
          html`<pre>${JSON.stringify(kindPackage.options, null, 2)}</pre>` :
          kindPackage.fields.map(
            (field) => this.#field(draft, kindPackage, field, readonly)
          )}
      </section>
      ${readonly ? nothing : this.#draft.actions("Kind option actions")}
    `;
  }

  #field(
    draft: KindOptionsDraft,
    kindPackage: KindPackageSettings,
    field: KindOptionField,
    readonly: boolean
  ): TemplateResult {
    return html`
      <jolly-number
        data-option=${`${kindPackage.name}:${field.path.join(".")}`}
        label=${field.label}
        .min=${field.min}
        .max=${field.max}
        .step=${1}
        .value=${draft.value(kindPackage.name, field)}
        ?readonly=${readonly}
        @jolly-change=${(event: CustomEvent<{ value: number; }>) => {
          this.#draft.edit(
            draft.with(kindPackage.name, field, event.detail.value)
          );
        }}
      ></jolly-number>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-kind-package": ProjectKindPackage;
  }
}
