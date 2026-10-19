// Import Third-party Dependencies
import {
  HOST_PREFERENCES,
  type PreferenceOverrides,
  type PreferenceScope
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { STUDIO_PREFERENCES } from "./studioScope.ts";

export class PreferenceScopes implements Iterable<PreferenceScope> {
  static studio(
    editorScopes: Iterable<PreferenceScope>
  ): PreferenceScopes {
    return new PreferenceScopes([
      STUDIO_PREFERENCES,
      ...HOST_PREFERENCES,
      ...editorScopes
    ]);
  }

  #scopes = new Map<string, PreferenceScope>();

  constructor(
    scopes: Iterable<PreferenceScope>
  ) {
    for (const scope of scopes) {
      const known = this.#scopes.get(scope.name);
      if (known === undefined) {
        this.#scopes.set(scope.name, scope);
      }
      else if (JSON.stringify(known) !== JSON.stringify(scope)) {
        throw new Error(`Two different "${scope.name}" preference scopes.`);
      }
    }
  }

  find(
    name: string
  ): PreferenceScope | undefined {
    return this.#scopes.get(name);
  }

  prune(
    stored: Iterable<readonly [string, unknown]>
  ): Map<string, PreferenceOverrides> {
    const overrides = new Map<string, PreferenceOverrides>();
    for (const [name, value] of stored) {
      const scope = this.#scopes.get(name);
      const pruned = scope?.prune(value) ?? {};
      if (Object.keys(pruned).length > 0) {
        overrides.set(name, pruned);
      }
    }

    return overrides;
  }

  [Symbol.iterator](): IterableIterator<PreferenceScope> {
    return this.#scopes.values();
  }
}
