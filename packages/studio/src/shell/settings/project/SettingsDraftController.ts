// Import Third-party Dependencies
import {
  html,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import type { ProjectSettingsController } from "./ProjectSettingsController.ts";
import type {
  StudioProjectSettings
} from "../../../project/StudioProjectSettings.ts";
import type { ProjectSettingsReply } from "../../../../shared/api/project.ts";

export interface SettingsDraft {
  toJSON(): unknown;
}

export interface SettingsDraftControllerOptions<TDraft extends SettingsDraft> {
  project: ProjectSettingsController;
  saved(data: ProjectSettingsReply): TDraft | null;
  save(project: StudioProjectSettings, draft: TDraft): Promise<boolean>;
}

export class SettingsDraftController<TDraft extends SettingsDraft> {
  #host: ReactiveControllerHost;
  #options: SettingsDraftControllerOptions<TDraft>;
  #edited: TDraft | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: SettingsDraftControllerOptions<TDraft>
  ) {
    this.#host = host;
    this.#options = options;
  }

  get current(): TDraft | null {
    return this.#edited ?? this.#saved();
  }

  get edited(): boolean {
    return this.#edited !== null;
  }

  get changed(): boolean {
    const saved = this.#saved();

    return this.#edited !== null && (
      saved === null ||
      JSON.stringify(this.#edited) !== JSON.stringify(saved)
    );
  }

  edit(
    draft: TDraft
  ): void {
    this.#edited = draft;
    this.#host.requestUpdate();
  }

  reset(): void {
    this.#edited = null;
    this.#host.requestUpdate();
  }

  actions(
    label: string
  ): TemplateResult {
    return html`
      <jolly-toolbar label=${label}>
        <jolly-button
          data-action="save"
          ?disabled=${!this.changed}
          @click=${() => this.save()}
        >Save</jolly-button>
        <jolly-button
          data-action="reset"
          ?disabled=${!this.edited}
          @click=${() => this.reset()}
        >Reset</jolly-button>
      </jolly-toolbar>
    `;
  }

  async save(): Promise<void> {
    const project = this.#options.project.current;
    if (project === null || this.#edited === null) {
      return;
    }

    if (await this.#options.save(project, this.#edited)) {
      this.reset();
    }
  }

  #saved(): TDraft | null {
    const data = this.#options.project.current?.data ?? null;

    return data === null ? null : this.#options.saved(data);
  }
}
