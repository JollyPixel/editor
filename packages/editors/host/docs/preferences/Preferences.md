# Preferences

A preference is a choice one user makes for themselves, such as the theme or
whether the grid shows. Preferences are grouped in scopes. A scope declares
its fields once, and the same declaration validates values in the browser and
on the studio server.

`@jolly-pixel/editor.host/preferences` holds the declarations, the
`Preferences` holder and the host's own scopes. It imports neither the DOM
nor Three.js, so a Node.js server can load it. `LocalPreferences`,
`PreferenceStorage`, `followCameraPreferences`, `followKeyBindings` and
`provideTourKeys` come from the package root.

## `definePreferences`

```ts
import { definePreferences } from "@jolly-pixel/editor.host/preferences";

export const VIEW_PREFERENCES = definePreferences({
  name: "voxel-map",
  label: "Voxel map",
  fields: {
    grid: {
      type: "boolean",
      label: "Grid",
      group: "View",
      default: true
    },
    gridSize: {
      type: "range",
      label: "Grid size",
      min: 1,
      max: 256,
      default: 16
    }
  }
});
```

`name` is kebab-case: overrides are stored under it. `label` titles the
scope's Settings page. Every field has a `label`, an optional `group` heading
and `description`, and a `default`:

```ts
type PreferenceField =
  | { type: "boolean"; default: boolean; }
  | {
    type: "enum";
    options: readonly { value: string; label: string; }[];
    default: string; // one of the option values
  }
  | {
    type: "range";
    min: number;
    max: number;
    step?: number; // default 1
    default: number;
  }
  | {
    type: "chord";
    default: readonly string[]; // KeyChord strings, [] leaves it unbound
  }
  | {
    type: "key";
    default: readonly string[]; // KeyboardEvent.code values, [] leaves it unbound
  }
  | {
    type: "color";
    default: string | null; // "#rrggbb", stored lowercase
  }
  | {
    type: "entries";
    default: Readonly<Record<string, string>>;
  };
```

- A chord field holds at most `MAX_CHORDS` (4) chords. Its strings are only
  checked for length; the editor's `KeyBindingMap` drops what it cannot read.
  Within a scope, a chord belongs to one field at most.
- A key field lists the keys held for an action, such as a camera move, by
  position and with no modifier: `"KeyW"`, `"ShiftLeft"`. It holds at most
  `MAX_CHORDS` codes, and shares the one-field rule with chord fields.
- An entries field is a string map that a store written for a `StorageAdapter`
  keeps through [`PreferenceStorage`](#preferencestorage). Its JSON is at most
  `MAX_ENTRIES_LENGTH` (32 KiB). Settings shows no form for it, only a Clear
  button.

`definePreferences` throws `InvalidPreferencesError` when the name is not
kebab-case, a range has `min` above `max`, or a field refuses its own default,
and its `ChordConflictError` subclass when two binding fields share a default.
An enum default outside its options is a type error.

## `defineKeyBindings`

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

A scope with one chord field per action of a `KeyBindingMap` defaults object,
so each default must be a valid `KeyChordString`.
`actions` gives each action its label and group; TypeScript requires one per
action. The studio lists every scope with chord fields on its Keybindings
page, and gives no page of its own to a scope that has nothing else.

## `PreferenceScope`

What both functions return. Overrides are the values that differ from the
defaults, as a plain object.

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
  label: string | null; // the fields' group, null when they have none
  fields: Array<[key: string, field: TField]>;
}
```

- `form` holds every field but the chord and key ones, and `keyBindings` the
  chord and key ones, each split by `group` in declaration order.
  `BindingPreference` is a chord or a key field, and `FormPreference` any
  other field.

- `resolve` returns every field: the valid overrides over the defaults,
  frozen. `PreferenceValues` types each field: `boolean`, the enum's option
  values, `number`, `readonly string[]`, `string | null` or the entries map.
- `prune` keeps the valid overrides and silently drops unknown fields,
  refused values and values equal to the default.
- `parse` reads a whole set of overrides and `update` applies a patch to
  some. Both throw `InvalidPreferencesError` on an unknown field or a refused
  value, and drop values equal to the default. They throw
  `ChordConflictError` when the result binds one chord to two fields; its
  `chord`, `key` and `owner` name the chord, a field the patch changed and the
  field that already held it.
- `bindings` returns the chords or codes of every binding field, the defaults
  where an override is missing or invalid.
- `toJSON` is the descriptor `PreferenceScope.from` reads back.

## `Preferences`

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
}

interface PreferenceChange {
  scope: string;
  patch: PreferenceOverrides; // the values the change set, by key
  overrides: PreferenceOverrides; // the scope once the change applied
}
```

- `update` validates the whole patch with the scope, then calls `write` and
  the listeners once. A patch that changes nothing does neither, and a refused
  one throws and changes nothing.
- `assign` updates one field, and `reset` writes the default back to one
  field or to every field of the scope, both as a single `update`.
- `receive` replaces a scope's overrides from elsewhere, another tab or the
  shell, and calls the listeners but not `write`.

An editor gets its `Preferences` as
[`context.preferences`](../editor/mountStandalone.md#editor-context).

## `LocalPreferences`

`Preferences` kept in `localStorage`, one key per scope:
`jolly-pixel:preferences:<scope>` (`LOCAL_PREFERENCES_KEY_PREFIX`). It follows
the writes of other tabs through the `storage` event until disposed. An editor
opened outside a shell, and the offline studio, use it.

```ts
using local = new LocalPreferences();
local.preferences.assign(CAMERA_PREFERENCES, "invertY", true);
```

`storage` defaults to `globalThis.localStorage`; `null` keeps the preferences
in memory. A write that throws, for a full quota, is kept in memory only.

## `PreferenceStorage`

```ts
new PreferenceStorage(preferences, scope, field);
```

A `StorageAdapter` whose keys are the entries of one entries field. A store
that took a `StorageAdapter`, such as `LanternSeen` or `UvNetLibrary`, keeps
its data with the account this way. It throws a `TypeError` for a field that
is not an entries field.

## `followKeyBindings`

```ts
function followKeyBindings<TAction extends string>(
  preferences: Preferences,
  scope: PreferenceScope<KeyBindingFields<TAction>>,
  onDropped?: (message: string) => void
): KeyBindingSettings<TAction>;

const settings = followKeyBindings(
  preferences,
  MAP_KEYBINDINGS,
  (message) => console.warn(message)
);
```

Returns a `KeyBindingSettings` over the defaults of a `defineKeyBindings`
scope, kept in step with that scope for the life of the page. The settings
load the scope's values now and again on every change made elsewhere, a swap
of two chords included, and `onDropped` receives each stored entry they
cannot read. Each change of the settings, such as a console command calling
`assign` or `reset`, is written to the scope as one `update`. Entries the
settings dropped while loading are written back without them.

## Host scopes

`HOST_PREFERENCES` lists the scopes the host declares for every editor:

- `RUNTIME_PREFERENCES` (`runtime`): `stats`, `viewHelper` and `metrics`, the
  visibility of the [runtime widgets](../runtime/EditorRuntime.md#runtime-widgets).
- `LANTERN_PREFERENCES` (`lantern`): `seen`, the tours finished, as entries.
- `CAMERA_PREFERENCES` (`camera`): `lookSensitivity` and `flySpeed`, two
  multipliers from 0.25 to 4, `invertY`, `touchpadSwipe`, `look` or `pan`,
  and one key field per `OrbitFlyCamera` key action: `forward`, `back`,
  `left`, `right`, `up`, `down`, `lookUp`, `lookDown`, `lookLeft` and
  `lookRight`. Every editor shares these keys.

```ts
const stop = followCameraPreferences(orbitFlyCamera, context.preferences);
```

`followCameraPreferences` takes the camera's own speeds as the base the
multipliers scale, so each editor keeps its tuning. It sets `moveSpeed` again
only when `flySpeed` changes, so the speed the wheel picked survives other
changes. It also sets the camera's `keys`.

## `provideTourKeys`

```ts
const release = provideTourKeys({
  lantern: context.lantern,
  preferences: context.preferences,
  scope: MAP_KEYBINDINGS,
  layout: keyboardLayoutStore,
  namespace: "map" // defaults to scope.name
});
```

Lets tour bodies name the scope's bindings: `` `{map.tool.brush}` `` shows
the key the user bound to `tool.brush`, labelled with the layout's
characters. The host provides `camera` on every page, so a tour can write
`` `{camera.forward}` ``.
