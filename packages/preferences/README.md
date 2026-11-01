## 💃 Getting Started

This workspace-private package is never published. Add it as a dependency of
an editor or the studio:

```json
{
  "dependencies": {
    "@jolly-pixel/preferences": "workspace:*"
  }
}
```

Consumers load the built `dist/` output, so run
`pnpm --filter @jolly-pixel/preferences build` after a change.

## 💡 About

A preference is a choice one user makes for themselves, such as whether the
grid shows. This package declares preference scopes, validates their values
and holds every scope's overrides in memory. It imports neither the DOM nor
Three.js, so the studio server validates preferences with the same
declarations the editors use.

The host's own scopes, `localStorage` storage and the adapters that apply
preferences to a camera or keybindings live in `@jolly-pixel/editor.host`.

## 👀 Usage example

```ts
import {
  Preferences,
  definePreferences
} from "@jolly-pixel/preferences";

const VIEW_PREFERENCES = definePreferences({
  name: "voxel-map",
  label: "Voxel map",
  fields: {
    grid: { type: "boolean", label: "Grid", group: "View", default: true },
    gridSize: { type: "range", label: "Grid size", min: 1, max: 256, default: 16 }
  }
});

const preferences = new Preferences({
  write: ({ scope, overrides }) => {
    localStorage.setItem(scope, JSON.stringify(overrides));
  }
});
preferences.watch(VIEW_PREFERENCES, ({ grid }) => {
  helper.visible = grid;
});

preferences.assign(VIEW_PREFERENCES, "gridSize", 32);
preferences.values(VIEW_PREFERENCES); // { grid: true, gridSize: 32 }
preferences.assign(VIEW_PREFERENCES, "gridSize", 999); // throws InvalidPreferencesError
```

A scope serializes to JSON, so the server rebuilds it from what an editor
sends and validates overrides with it:

```ts
import { PreferenceScope } from "@jolly-pixel/preferences";

const scope = PreferenceScope.from(JSON.parse(body));
scope.parse({ grid: false, gridSize: 16 }); // { grid: false }
```

## 📚 API

- [`PreferenceScope`](./docs/PreferenceScope.md): `definePreferences`,
  `defineKeyBindings`, the scope they return and its errors.
- [`Preferences`](./docs/Preferences.md): the overrides of every scope.

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ pnpm run test
$ pnpm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../CONTRIBUTING.md
