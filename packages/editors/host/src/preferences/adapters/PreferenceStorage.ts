// Import Third-party Dependencies
import type { StorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { Preferences } from "../store/Preferences.ts";
import type { PreferenceScope } from "../scope/PreferenceScope.ts";

export class PreferenceStorage implements StorageAdapter {
  #preferences: Preferences;
  #scope: PreferenceScope;
  #field: string;

  constructor(
    preferences: Preferences,
    scope: PreferenceScope,
    field: string
  ) {
    if (scope.fields[field]?.type !== "entries") {
      throw new TypeError(`"${scope.name}.${field}" is not an entries field.`);
    }

    this.#preferences = preferences;
    this.#scope = scope;
    this.#field = field;
  }

  get(
    key: string
  ): string | null {
    const entries = this.#entries();

    return Object.hasOwn(entries, key) ? entries[key] : null;
  }

  set(
    key: string,
    value: string
  ): void {
    this.#preferences.assign(this.#scope, this.#field, {
      ...this.#entries(),
      [key]: value
    });
  }

  #entries(): Readonly<Record<string, string>> {
    const entries: unknown = this.#preferences.values(this.#scope)[this.#field];
    const strings: Record<string, string> = {};
    if (typeof entries === "object" && entries !== null) {
      for (const [key, value] of Object.entries(entries)) {
        if (typeof value === "string") {
          strings[key] = value;
        }
      }
    }

    return strings;
  }
}
