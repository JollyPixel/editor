# Preferences

The overrides of every scope, in memory.

```ts
class Preferences implements Iterable<[string, PreferenceOverrides]> {
  constructor(options?: {
    overrides?: Iterable<readonly [string, PreferenceOverrides]>;
    write?: (change: PreferenceChange) => void;
  });

  values(scope: PreferenceScope): PreferenceValues;
  overrides(scope: string): PreferenceOverrides;
  update(scope: PreferenceScope, patch: PreferenceOverrides): void;
  assign(scope: PreferenceScope, key: string, value: unknown): void;
  reset(scope: PreferenceScope, key?: string): void;
  receive(scope: string, overrides: PreferenceOverrides): void;
  subscribe(listener: (scope: string, overrides: PreferenceOverrides) => void): () => void;
  watch(scope: PreferenceScope, listener: (values: PreferenceValues) => void): () => void;
  view(): Preferences;
  dispose(): void;
}

interface PreferenceChange {
  scope: string;
  patch: PreferenceOverrides;
  overrides: PreferenceOverrides; // the scope after the change
}
```

- `update` validates the patch, then calls `write` and the listeners once. A
  patch that changes nothing does neither; a refused one throws.
- `assign` and `reset` are single-field `update`s; `reset` without `key`
  resets the whole scope.
- `receive` takes overrides from elsewhere, another tab or the shell, and
  calls the listeners but not `write`.
- `view()` shares the overrides and `write`; its `dispose()` stops only the
  listeners added through it. An editor's `context.preferences` is such a view.
- Iterating yields `[scope, overrides]` for every scope with overrides.
