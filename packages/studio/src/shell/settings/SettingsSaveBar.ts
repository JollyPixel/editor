// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { customElement } from "lit/decorators.js";
import "@jolly-pixel/ui/elements/button";

// Import Internal Dependencies
import type { StudioProjectSettings } from "../../project/StudioProjectSettings.ts";
import { ProjectSettingsController } from "./project/ProjectSettingsController.ts";

@customElement("studio-settings-save-bar")
export class SettingsSaveBar extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--jolly-space-2);
      padding: var(--jolly-space-2) var(--jolly-space-3);
      border-top: 1px solid var(--jolly-border);
      background: var(--jolly-surface-raised);
    }

    :host([hidden]) {
      display: none;
    }

    p {
      flex: 1;
      min-width: 0;
      margin: 0;
    }

    p[data-tone="danger"] {
      color: var(--jolly-ink-danger);
    }
  `;

  #project = new ProjectSettingsController(this);

  set project(
    project: StudioProjectSettings
  ) {
    this.#project.attach(project);
  }

  override willUpdate(): void {
    const project = this.#project.current;
    this.hidden = project === null || (
      !project.drafts.changed && !project.conflict && project.error === null
    );
  }

  override render(): TemplateResult | typeof nothing {
    const project = this.#project.current;
    if (project === null) {
      return nothing;
    }
    if (project.conflict) {
      return this.#conflict(project);
    }

    return html`
      <p
        role="status"
        data-tone=${project.error === null ? nothing : "danger"}
      >${project.error ?? "Unsaved changes"}</p>
      <jolly-button
        data-action="reset-settings"
        ?disabled=${project.loading || !project.drafts.changed}
        @click=${() => project.discard()}
      >Reset</jolly-button>
      <jolly-button
        variant="accent"
        data-action="save-settings"
        ?disabled=${project.loading || !project.drafts.changed}
        @click=${() => void project.save()}
      >Save</jolly-button>
    `;
  }

  #conflict(
    project: StudioProjectSettings
  ): TemplateResult {
    return html`
      <p role="alert" data-tone="danger">
        Someone else saved the project settings since you opened them.
      </p>
      <jolly-button
        data-action="reload-settings"
        ?disabled=${project.loading}
        @click=${() => void project.reload()}
      >Reload</jolly-button>
      <jolly-button
        variant="danger"
        data-action="overwrite-settings"
        ?disabled=${project.loading}
        @click=${() => void project.overwrite()}
      >Overwrite</jolly-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-settings-save-bar": SettingsSaveBar;
  }
}
