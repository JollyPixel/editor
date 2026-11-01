# PreferenceScope

A preference is a choice one user makes for themselves, such as the theme or
whether the grid shows. Preferences are grouped in scopes, and one scope
declaration validates values in the browser and on the studio server.

## definePreferences

```ts
import { definePreferences } from "@jolly-pixel/preferences";

export const VIEW_PREFERENCES = definePreferences({
  name: "voxel-map",
  label: "Voxel map",
  fields: {
    grid: { type: "boolean", label: "Grid", group: "View", default: true },
    gridSize: { type: "range", label: "Grid size", min: 1, max: 256, default: 16 }
  }
});
```

`name` is kebab-case; overrides are stored under it. `label` titles the
scope's Settings page. Every field has a `label`, a `default`, and an optional
`group` heading and `description`:

```ts
type PreferenceField =
  | { type: "boolean"; default: boolean; }
  | {
    type: "enum";
    options: readonly { value: string; label: string; }[];
    default: string; // one of the option values
  }
  | { type: "range"; min: number; max: number; step?: number; default: number; } // step: 1
  | { type: "chord"; default: readonly string[]; } // KeyChord strings
  | { type: "key"; default: readonly string[]; } // KeyboardEvent.code values
  | { type: "color"; default: string | null; } // "#rrggbb", stored lowercase
  | { type: "entries"; default: Readonly<Record<string, string>>; };
```

- `chord` and `key` fields hold at most `MAX_CHORDS` (4) values; `[]` leaves
  the action unbound. A key field lists keys held for an action, such as a
  camera move, with no modifier.
- Within a scope, a chord or key belongs to one field at most.
- An `entries` field is a string map of at most `MAX_ENTRIES_LENGTH` (32 KiB)
  of JSON. Settings shows only a Clear button for it.

Throws `InvalidPreferencesError` when the name is not kebab-case, a range has
`min` above `max`, or a field refuses its own default, and its
`ChordConflictError` subclass when two binding fields share a default.

## defineKeyBindings

```ts
export const MAP_KEYBINDINGS = defineKeyBindings({
  name: "voxel-map-keybindings",
  label: "Voxel map",
  defaults: MAP_KEY_BINDINGS,
  actions: {
    "tool.brush": { label: "Brush tool", group: "Tools" }
  }
});
```

A scope with one chord field per action of a `KeyBindingMap` defaults object.
TypeScript requires a label for every action. The studio lists these scopes
on its Keybindings page.

## PreferenceScope

What both functions return. Overrides are the values that differ from the
defaults.

```ts
class PreferenceScope<TFields> {
  static from(descriptor: unknown): PreferenceScope;

  readonly name: string;
  readonly label: string;
  readonly fields: TFields;
  readonly form: readonly PreferenceFieldGroup<FormPreference>[];
  readonly keyBindings: readonly PreferenceFieldGroup<BindingPreference>[];
  readonly defaults: PreferenceValues<TFields>;

  has(key: string): boolean;
  resolve(overrides: PreferenceOverrides): PreferenceValues<TFields>;
  prune(input: unknown): PreferenceOverrides;
  parse(input: unknown): PreferenceOverrides;
  update(overrides: PreferenceOverrides, patch: PreferenceOverrides): PreferenceOverrides;
  bindings(overrides: PreferenceOverrides): Map<string, readonly string[]>;
  toJSON(): PreferenceScopeDefinition<TFields>;
}

interface PreferenceFieldGroup<TField> {
  label: string | null; // null for fields without a group
  fields: Array<[key: string, field: TField]>;
}
```

- `form` groups the non-binding fields and `keyBindings` the chord and key
  fields, in declaration order.
- `resolve` returns every field, overrides over defaults, frozen.
- `prune` keeps the valid overrides and silently drops the rest.
- `parse` and `update` throw `InvalidPreferencesError` on an unknown field or
  a refused value, and `ChordConflictError` when the result binds one chord to
  two fields.
- `bindings` maps every chord and key field to its stored value, or to its
  default when the override is missing or invalid.
- `toJSON` is the descriptor `PreferenceScope.from` reads back. `from` throws
  a zod error on a malformed descriptor.

## Errors

```ts
class InvalidPreferencesError extends Error {
  readonly scope: string;
}

class ChordConflictError extends InvalidPreferencesError {
  readonly chord: string;
  readonly key: string; // the field that took the chord
  readonly owner: string; // the field already bound to it
}
```
