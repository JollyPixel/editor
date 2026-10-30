# Preferences

A preference is a choice one user makes for themselves, such as the theme or
whether the grid shows. Preferences are grouped in scopes, and one scope
declaration validates values in the browser and on the studio server.

`@jolly-pixel/editor.host/preferences` holds the declarations, the
`Preferences` holder and the host scopes, with no DOM or Three.js import.
`LocalPreferences`, `followCameraPreferences`, `followKeyBindings` and
`provideTourKeys` come from the package root.

## definePreferences

```ts
import { definePreferences } from "@jolly-pixel/editor.host/preferences";

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
- `toJSON` is the descriptor `PreferenceScope.from` reads back.

## Preferences

The overrides of every scope, in memory.

```ts
class Preferences implements Iterable<[string, PreferenceOverrides]> {
  constructor(options?: {
    overrides?: Iterable<[string, PreferenceOverrides]>;
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
  listeners added through it. `context.preferences` is such a view.

## LocalPreferences

`Preferences` kept in `localStorage` under
`jolly-pixel:preferences:<scope>`, following the writes of other tabs until
disposed. Editors outside a shell and the offline studio use it.

```ts
using local = new LocalPreferences();
local.preferences.assign(CAMERA_PREFERENCES, "invertY", true);
```

`storage: null` keeps the preferences in memory. A write that throws, such
as a full quota, stays in memory.

## followKeyBindings

```ts
const settings = followKeyBindings(
  preferences,
  MAP_KEYBINDINGS,
  (message) => console.warn(message)
);
```

Returns a `KeyBindingSettings` that follows a `defineKeyBindings` scope:

- It loads the scope's values now and on every change made elsewhere.
- Each change of the settings, such as a console `assign`, is written back as
  one `update`.
- `onDropped` receives each stored entry it cannot read, and the scope is
  written back without those entries.

## Host scopes

`HOST_PREFERENCES` lists the scopes the host declares for every editor:

- `RUNTIME_PREFERENCES` (`runtime`): `stats`, `viewHelper` and `metrics`
  widget visibility.
- `LANTERN_PREFERENCES` (`lantern`): `seen`, the finished tours.
- `CAMERA_PREFERENCES` (`camera`): `lookSensitivity` and `flySpeed`
  multipliers (0.25 to 4), `invertY`, `touchpadSwipe` (`look` or `pan`), and
  one key field per `OrbitFlyCamera` action, `forward` to `lookRight`.
- `COLOR_PICKER_PREFERENCES` (`color-picker`): the colour picker settings.
  Every picker on the page follows them unless it sets its own property.

```ts
const stop = followCameraPreferences(orbitFlyCamera, context.preferences);
```

`followCameraPreferences` scales the camera's own speeds by the multipliers
and sets its `keys`. It sets `moveSpeed` again only when `flySpeed` changes,
so a speed picked with the wheel survives other changes.

## provideTourKeys

```ts
const release = provideTourKeys({
  lantern: context.lantern,
  preferences: context.preferences,
  scope: MAP_KEYBINDINGS,
  layout: keyboardLayoutStore,
  namespace: "map" // defaults to scope.name
});
```

Lets tour bodies show the user's bindings: `` `{map.tool.brush}` `` prints
the key bound to `tool.brush`, labelled for the user's keyboard. The host
provides `camera` on every page, as in `` `{camera.forward}` ``.
