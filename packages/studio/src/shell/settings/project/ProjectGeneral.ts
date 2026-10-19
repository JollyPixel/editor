// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import type { StudioProjectSettings } from "../../../project/StudioProjectSettings.ts";
import { settingsStyles } from "../settingsStyles.ts";
import { ProjectSettingsController } from "./ProjectSettingsController.ts";

@customElement("studio-project-general")
export class ProjectGeneral extends LitElement {
  static override styles = [settingsStyles, css`
    ul {
      margin: 0;
      padding-inline-start: var(--jolly-space-4);
    }
  `];

  #project = new ProjectSettingsController(this);

  set project(
    project: StudioProjectSettings
  ) {
    this.#project.attach(project);
  }

  override render(): TemplateResult | typeof nothing {
    const project = this.#project.current;
    if (project === null) {
      return nothing;
    }

    return html`
      ${this.#project.error()}
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-general": ProjectGeneral;
  }
}
