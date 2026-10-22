// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { ProjectRights } from "../../shared/ProjectRights.ts";

export class OfflineUser extends EventTarget {
  readonly online = false;
  readonly rights = ProjectRights.NONE;
  readonly preferences: Preferences;

  constructor(
    preferences: Preferences
  ) {
    super();
    this.preferences = preferences;
  }

  onPreferenceError(): () => void {
    return () => undefined;
  }
}
