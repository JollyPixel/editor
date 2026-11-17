## 📌 About

Private asset workspace for environments (kind `environment`, `.environment.json`). An environment is the sky, sun, ambient light, reflections, fog, tone mapping, glow and voxel shading a scene renders in. The file is the engine's `EnvironmentFile`: the engine applies it in the game, and the editors apply the same file in their viewports.

- A new environment is a copy of the engine's `default` preset.
- `environment-changed` sets whole sections (`sky`, `sun`, `fog`, ...). Two peers editing different sections both keep their change; undo restores only the sections a change set.
- Scenes reference an environment by id. The scene kind lists it as a dependency, so a game export ships it.
- The client entry (`@jolly-pixel/asset.environment/client`) gives `EnvironmentDocument`, `environmentDocumentKind()`, `EnvironmentSwitch` (default values when the sky, fog, sun or glow changes kind), `EnvironmentLink`, which follows one environment document while its id stays the same and opens it again on a later link after a failed open, `environmentOpener(session)`, which opens an id only when the catalog records it as an environment, and `PreviewEnvironment`, which lists the project's environments behind a "Lighting preset" option and resolves the file an editor viewport shows: the previewed environment or the editor's preset, with reflections off when the view turns them off.

- `createEnvironmentFile(preset?)` copies an engine preset (`ENVIRONMENT_PRESET_NAMES`), `default` when none is named.

Browser code imports `@jolly-pixel/asset.environment/client`. The package root also builds the command schemas. The server entry (`@jolly-pixel/asset.environment/server`) adds `environmentEditableKind()`, the command schema and protocol a Node peer such as the golem needs to send commands. The golem entry (`@jolly-pixel/asset.environment/golem`, `src/golem/`) is what gives agents this kind: see [Golem](./docs/Golem.md).

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.environment build
```

Editors load the built `dist/` output, so rebuild after a change before running them.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.environment test
$ pnpm --filter @jolly-pixel/asset.environment lint
```

## License

MIT
