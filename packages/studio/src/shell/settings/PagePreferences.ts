// Import Third-party Dependencies
import type {
  Preferences,
  PreferenceScope
} from "@jolly-pixel/preferences";

export class PagePreferences {
  #preferences: Preferences;
  #scopes: readonly PreferenceScope[];

  constructor(
    preferences: Preferences,
    scopes: readonly PreferenceScope[]
  ) {
    this.#preferences = preferences;
    this.#scopes = scopes;
  }

  get customized(): boolean {
    return this.#scopes.some(
      (scope) => Object.keys(this.#preferences.overrides(scope.name)).length > 0
    );
  }

  reset(): void {
    for (const scope of this.#scopes) {
      this.#preferences.reset(scope);
    }
  }
}
