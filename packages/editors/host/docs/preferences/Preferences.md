# Preferences

Scope declarations and the `Preferences` holder come from
`@jolly-pixel/preferences`. The host adds the scopes every editor shares,
their `localStorage` store and the adapters below.

`@jolly-pixel/editor.host/preferences` holds the host scopes, with no DOM or
Three.js import. `LocalPreferences`, `followKeyBindings` and
`provideTourKeys` come from the package root, `followCameraPreferences`
from `@jolly-pixel/editor.host/viewport`.

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
