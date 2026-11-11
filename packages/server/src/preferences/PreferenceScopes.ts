// Import Third-party Dependencies
import type {
  PreferenceOverrides,
  PreferenceScope
} from "@jolly-pixel/preferences";

export interface EditorPreferenceScopes {
  name: string;
  scopes: readonly PreferenceScope[];
  shared: readonly PreferenceScope[];
}

export interface ShellPreferences {
  /**
   * The scopes the shell declares.
   */
  scopes: readonly PreferenceScope[];
  /**
   * The scopes every editor reads, such as the editor host's.
   */
  common: readonly PreferenceScope[];
}

export const NO_SHELL_PREFERENCES: ShellPreferences = {
  scopes: [],
  common: []
};

export class PreferenceScopes implements Iterable<PreferenceScope> {
  #scopes = new Map<string, PreferenceScope>();
  #common: ReadonlySet<string>;
  #readBy = new Map<string, ReadonlySet<string>>();

  constructor(
    shell: ShellPreferences,
    editors: Iterable<EditorPreferenceScopes>
  ) {
    this.#common = new Set(shell.common.map((scope) => scope.name));
    for (const scope of [...shell.scopes, ...shell.common]) {
      this.#add(scope);
    }
    for (const { name, scopes, shared } of editors) {
      const read = [...scopes, ...shared];
      for (const scope of read) {
        this.#add(scope);
      }
      this.#readBy.set(name, new Set([
        ...this.#common,
        ...read.map((scope) => scope.name)
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
    return this.#readBy.get(editor) ?? this.#common;
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

  #add(
    scope: PreferenceScope
  ): void {
    const known = this.#scopes.get(scope.name);
    if (known === undefined) {
      this.#scopes.set(scope.name, scope);
    }
    else if (JSON.stringify(known) !== JSON.stringify(scope)) {
      throw new Error(`Two different "${scope.name}" preference scopes.`);
    }
  }
}
