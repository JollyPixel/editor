// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  PROJECT_SETTINGS_CHANGE,
  type StudioProjectSettings
} from "../../../project/StudioProjectSettings.ts";

export class ProjectSettingsController
  extends SubscriptionController<StudioProjectSettings> {
  constructor(
    host: ReactiveControllerHost
  ) {
    super(host, (project) => {
      function repaint(): void {
        host.requestUpdate();
      }
      project.addEventListener(PROJECT_SETTINGS_CHANGE, repaint);
      if (project.data === null) {
        void project.load();
      }

      return [
        () => project.removeEventListener(PROJECT_SETTINGS_CHANGE, repaint)
      ];
    });
  }

  error(): TemplateResult | typeof nothing {
    const message = this.current?.error ?? null;

    return message === null ?
      nothing :
      html`<p class="error" role="alert">${message}</p>`;
  }
}
