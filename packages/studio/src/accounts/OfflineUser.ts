// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/preferences";
import { ProjectRights } from "@jolly-pixel/server";

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
