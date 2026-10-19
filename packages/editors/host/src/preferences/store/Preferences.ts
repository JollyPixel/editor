// Import Internal Dependencies
import { samePreferenceValue } from "../scope/PreferenceField.ts";
import type {
  PreferenceFields,
  PreferenceOverrides,
  PreferenceScope,
  PreferenceValues
} from "../scope/PreferenceScope.ts";

export interface PreferenceChange {
  scope: string;
  /**
   * The values the change set, by key.
   */
  patch: PreferenceOverrides;
  /**
   * Overrides of the scope once the change applied.
   */
  overrides: PreferenceOverrides;
}

export type PreferenceWriter = (change: PreferenceChange) => void;

export type PreferenceListener = (
  scope: string,
  overrides: PreferenceOverrides
) => void;

export interface PreferencesOptions {
  overrides?: Iterable<readonly [string, PreferenceOverrides]>;
  /**
   * Persists a change made through `update`, `assign` or `reset`.
   */
  write?: PreferenceWriter;
}

export class Preferences {
  #overrides: Map<string, PreferenceOverrides>;
  #listeners = new Set<PreferenceListener>();
  #write: PreferenceWriter | undefined;

  constructor(
    options: PreferencesOptions = {}
  ) {
    this.#overrides = new Map(options.overrides);
    this.#write = options.write;
  }

  values<TFields extends PreferenceFields>(
    scope: PreferenceScope<TFields>
  ): PreferenceValues<TFields> {
    return scope.resolve(this.overrides(scope.name));
  }

  overrides(
    scope: string
  ): PreferenceOverrides {
    return this.#overrides.get(scope) ?? {};
  }

  update(
    scope: PreferenceScope,
    patch: PreferenceOverrides
  ): void {
    const current = this.overrides(scope.name);
    const overrides = scope.update(current, patch);
    if (sameOverrides(current, overrides)) {
      return;
    }

    this.#store(scope.name, overrides);
    const values: PreferenceOverrides = scope.resolve(overrides);
    this.#write?.({
      scope: scope.name,
      patch: Object.fromEntries(
        Object.keys(patch).map((key) => [key, values[key]])
      ),
      overrides
    });
  }

  assign(
    scope: PreferenceScope,
    key: string,
    value: unknown
  ): void {
    this.update(scope, { [key]: value });
  }

  reset(
    scope: PreferenceScope,
    key?: string
  ): void {
    const keys = key === undefined ?
      Object.keys(scope.fields) :
      [key].filter((field) => scope.has(field));

    this.update(scope, Object.fromEntries(
      keys.map((field) => [field, scope.fields[field].default])
    ));
  }

  receive(
    scope: string,
    overrides: PreferenceOverrides
  ): void {
    if (!sameOverrides(this.overrides(scope), overrides)) {
      this.#store(scope, overrides);
    }
  }

  subscribe(
    listener: PreferenceListener
  ): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  watch<TFields extends PreferenceFields>(
    scope: PreferenceScope<TFields>,
    listener: (values: PreferenceValues<TFields>) => void
  ): () => void {
    return this.subscribe((name) => {
      if (name === scope.name) {
        listener(this.values(scope));
      }
    });
  }

  * [Symbol.iterator](): IterableIterator<[string, PreferenceOverrides]> {
    yield* this.#overrides;
  }

  #store(
    scope: string,
    overrides: PreferenceOverrides
  ): void {
    if (Object.keys(overrides).length === 0) {
      this.#overrides.delete(scope);
    }
    else {
      this.#overrides.set(scope, overrides);
    }
    for (const listener of this.#listeners) {
      listener(scope, overrides);
    }
  }
}

function sameOverrides(
  left: PreferenceOverrides,
  right: PreferenceOverrides
): boolean {
  const keys = Object.keys(left);

  return keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) &&
      samePreferenceValue(left[key], right[key]));
}
