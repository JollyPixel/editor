// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import type { StudioProjectSettings } from "../../../project/StudioProjectSettings.ts";
import { RemoteStateController } from "../../RemoteStateController.ts";

export class ProjectSettingsController
  extends RemoteStateController<StudioProjectSettings> {
  constructor(
    host: ReactiveControllerHost
  ) {
    super(host, (project) => {
      if (project.data === null) {
        void project.load();
      }

      return [];
    });
  }
}
