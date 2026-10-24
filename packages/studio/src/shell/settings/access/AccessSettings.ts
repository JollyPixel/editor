// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { customElement } from "lit/decorators.js";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/separator";

// Import Internal Dependencies
import { AccessDraft } from "../../../project/AccessDraft.ts";
import type { StudioProjectSettings } from "../../../project/StudioProjectSettings.ts";
import { SettingsDraftController } from "../project/SettingsDraftController.ts";
import {
  settingsColumnsStyles,
  settingsStyles
} from "../settingsStyles.ts";
import "./RolesEditor.ts";

@customElement("studio-access-settings")
export class AccessSettings extends LitElement {
  static override styles = [settingsStyles, settingsColumnsStyles];

  #draft = new SettingsDraftController(this, {
    saved: (data) => (data.access === undefined ? null : AccessDraft.from(data.access)),
    save: (project, draft) => project.replaceAccess(draft.toChange())
  });

  set project(
    project: StudioProjectSettings
  ) {
    this.#draft.attach(project);
  }

  override render(): TemplateResult | typeof nothing {
    const { draft } = this.#draft;
    if (draft === null) {
      return this.#draft.error();
    }

    return html`
      ${this.#draft.error()}
      <div class="columns split">
        <section aria-label="Roles">
          <jolly-separator label="Roles"></jolly-separator>
          <studio-roles-editor
            .draft=${draft}
            @access-draft=${(event: HTMLElementEventMap["access-draft"]) => {
              this.#draft.edit(event.draft);
            }}
          ></studio-roles-editor>
        </section>
        <section aria-label="New accounts">
          <jolly-separator label="New accounts"></jolly-separator>
          <jolly-select
            data-field="default-role"
            label="Default role"
            description="The role a new account gets"
            description-display="tooltip"
            .options=${draft.roles.map((role) => {
              return {
                value: role,
                label: role
              };
            })}
            .value=${draft.defaultRole}
            @jolly-change=${(event: CustomEvent<{ value: string; }>) => {
              this.#draft.edit(draft.withDefaultRole(event.detail.value));
            }}
          ></jolly-select>
          <jolly-checkbox
            data-field="access-requests"
            label="Access requests"
            description="Registering without the master password asks an admin first"
            .value=${draft.accessRequests}
            @jolly-change=${(event: CustomEvent<{ value: boolean; }>) => {
              this.#draft.edit(draft.withAccessRequests(event.detail.value));
            }}
          ></jolly-checkbox>
        </section>
      </div>
      ${this.#draft.actions("Access actions")}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-access-settings": AccessSettings;
  }
}
