// Import Third-party Dependencies
import {
  HOST_PREFERENCES,
  type PreferenceOverrides,
  type PreferenceScope
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { STUDIO_PREFERENCES } from "./studioScope.ts";

// CONSTANTS
export const SHELL_PREFERENCES: readonly PreferenceScope[] = [
  STUDIO_PREFERENCES,
  ...HOST_PREFERENCES
];
const kHostScopeNames: ReadonlySet<string> = new Set(
  HOST_PREFERENCES.map((scope) => scope.name)
);

export interface EditorPreferenceScopes {
  name: string;
  scopes: readonly PreferenceScope[];
  shared: readonly PreferenceScope[];
}

export class PreferenceScopes implements Iterable<PreferenceScope> {
  static studio(
    editors: Iterable<EditorPreferenceScopes>
  ): PreferenceScopes {
    const list = [...editors];

    return new PreferenceScopes(
      [
        ...SHELL_PREFERENCES,
        ...list.flatMap(({ scopes, shared }) => [...scopes, ...shared])
      ],
      list
    );
  }

  #scopes = new Map<string, PreferenceScope>();
  #readBy = new Map<string, ReadonlySet<string>>();

  constructor(
    scopes: Iterable<PreferenceScope>,
    editors: Iterable<EditorPreferenceScopes>
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
    for (const { name, scopes: own, shared } of editors) {
      this.#readBy.set(name, new Set([
        ...kHostScopeNames,
        ...[...own, ...shared].map((scope) => scope.name)
      ]));
    }
  }

  find(
    name: string
  ): PreferenceScope | undefined {
    return this.#scopes.get(name);
  }

  readBy(
    editor: string
  ): ReadonlySet<string> {
    return this.#readBy.get(editor) ?? kHostScopeNames;
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
