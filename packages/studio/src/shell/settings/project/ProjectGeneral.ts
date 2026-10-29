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
import "@jolly-pixel/ui/elements/separator";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/toggle";

// Import Internal Dependencies
import { AssetKindSet } from "../../../catalog/AssetKindSet.ts";
import type { StudioProjectSettings } from "../../../project/StudioProjectSettings.ts";
import { KindFilter } from "../../../../shared/KindFilter.ts";
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsDraftController } from "./SettingsDraftController.ts";

@customElement("studio-project-general")
export class ProjectGeneral extends LitElement {
  static override styles = [settingsStyles, css`
    ul {
      margin: 0;
      padding-inline-start: var(--jolly-space-4);
    }
  `];

  #draft = new SettingsDraftController(this, {
    saved: (data) => KindFilter.from(data.kindFilter),
    save: (project, draft) => project.replaceKindFilter(draft)
  });

  @property({ attribute: false })
  declare kinds: AssetKindSet;

  constructor() {
    super();
    this.kinds = AssetKindSet.EMPTY;
  }

  set project(
    project: StudioProjectSettings
  ) {
    this.#draft.attach(project);
  }

  override render(): TemplateResult | typeof nothing {
    const { project, draft } = this.#draft;
    if (project === null) {
      return nothing;
    }

    return html`
      ${this.#draft.error()}
      <jolly-text
        label="Name"
        description="The name of the project folder"
        readonly
        .value=${project.data?.name ?? ""}
      ></jolly-text>
      <section aria-label="Editor packages">
        <jolly-separator label="Editor packages"></jolly-separator>
        <ul>
          ${project.data?.editors.map((editor) => html`<li>${editor}</li>`)}
        </ul>
      </section>
      ${draft === null ? nothing : this.#kindFilter(draft, !project.canEdit)}
    `;
  }

  #kindFilter(
    draft: KindFilter,
    readonly: boolean
  ): TemplateResult {
    return html`
      <section aria-label="Kind filter">
        <jolly-separator label="Kind filter"></jolly-separator>
        ${this.kinds.entries.map(({ kind, label }) => html`
          <jolly-toggle
            data-kind=${kind}
            label=${label}
            .value=${draft.shows(kind)}
            ?readonly=${readonly}
            @jolly-change=${(event: CustomEvent<{ value: boolean; }>) => {
              this.#draft.edit(draft.with(kind, event.detail.value));
            }}
          ></jolly-toggle>
        `)}
      </section>
      ${readonly ? nothing : this.#draft.actions("Kind filter actions")}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-general": ProjectGeneral;
  }
}
