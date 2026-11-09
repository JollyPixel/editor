# Play and build a game

A project becomes a game: a start scene, the project's assets built into
runtime artifacts, and a player page that boots `@jolly-pixel/runtime` from a
`game.json` manifest. F5 plays the project's default scene in a separate
window; Ctrl+F5 plays the scene open in the active tab.

Builds run in the asset back-end, so everyone on one back-end shares them.
An artifact depends on its own asset's content only, which keeps the cache key
simple and makes the build incremental per asset.

## Decisions

### Builds belong to the asset back-end

A kind handler declares an optional `build` hook next to `preview`. The Node
back-end runs it when the studio is hosted; the in-page `OfflineServer` runs it
offline. A hook works in both, splitting Node-only code behind a `#imports`
condition the way `#stripper` and `#outliner` do.

### Runtime contributions

A package that adds component types declares a second subpath with runtime
code only:

```json
{
  "jollypixel": {
    "scene": "./scene",
    "runtime": "./runtime"
  }
}
```

```ts
interface RuntimeComponentPackage {
  definitions: readonly Systems.ComponentDefinition[];
  loaders?: readonly RuntimeAssetLoaderDefinition[];
}

export const RUNTIME_COMPONENTS: RuntimeComponentPackage;
```

- `SCENE_COMPONENTS` imports the same definition objects, so a component type
  is defined once.
- The player reads `virtual:jolly-pixel/contributions/runtime`, resolved against
  the project like the scene contributions.
- A loader produces the value type the editor's slot expects: `voxelmap`
  decodes a `VoxelDocument` into a `VoxelMapSource`. Scripts are the
  exception, see below.
- Camera, Light, Mesh, Text and RigidBody are `editor.scene`'s own runtime
  entry. `physics.rapier` is not a project package, so it cannot contribute:
  attaching the Rapier physics world before play falls to the contribution
  that owns RigidBody, through a setup hook added with the player (step 3).
- The contract lives in `@jolly-pixel/runtime` (`RuntimeComponentPackage`,
  `contributedRuntimeComponents`); packages import it as a type.
- `studio/test/vite/runtimeContributions.bundle.spec.ts` fails when a runtime
  entry pulls in `editor.host`, `asset-server`, `event-store` or `network`
  client and server code. `network`'s `protocol/` schemas are allowed: the
  voxel-model document validates with them, and its loader will need that
  document.

### Scripts compile one module per asset

The `script` build hook compiles with TypeScript's `transpileModule` (from
ts-morph, Node only): `@SceneProperty` is a legacy decorator, which
strip-only compilers leave as syntax no browser runs. It drops type-only
imports and checks the others with es-module-lexer:

- Another script stays a relative import, `./Enemy.ts`. Resolving it to an
  asset ID at build time would need the catalog and would put another asset's
  path into the artifact, so the player resolves it against the importing
  script's project path instead. Editing `Enemy.ts` leaves `Player.ts` built.
- `@jolly-pixel/engine`, `three`, `three/webgpu` and `three/tsl` stay bare. The
  player links them to `data:` modules over its own copies (the registry
  `ShaderModule` used), so scripts and components share one engine and one
  three.js.
- Any other import fails the build and names the specifier. npm dependencies
  in scripts are out of scope.

The game's `script` loader links and imports the module and returns its
exports; an imported script is linked first, and every importer links the
same `data:` URL, so it is evaluated once. Scripts that import each other are
refused: a `data:` module
needs its imports' URLs before it exists. `ScriptDefinition.create` takes
`exports[data.behavior]` from the slot value, so two scripts may both export
`Player`. The editor keeps `ScriptOutline` as its slot value: the script
package declares two `AssetType`s on the `script` kind, one per side.
Shaders build and load the same way, three.js imports only.

### Artifacts and their key

```ts
interface AssetBuild<TState> {
  readonly version: string;

  build(state: TState, content: Uint8Array): Promise<Uint8Array>;
}
```

- An artifact keeps the asset's extension, and its media type comes from the
  handler's `extensions`: the engine's model loader picks GLTF, FBX or OBJ by
  extension. A hook may declare its own media `type` (scripts and shaders,
  `text/javascript`).
- Key: `sha256(kind, build.version, contentHash(content))`.
- Another asset never enters the artifact. A loader loads the assets its value
  needs through `AssetLoadContext.assets` (a voxel map its blocksets, a voxel
  model its texture); a prefab stays a scene `FileScene` expands.
- A path never enters the key: renaming or moving an asset rebuilds nothing.
- `AssetBuilds` keeps an in-memory revision index, catalog `revision` to key,
  so an unchanged asset is serialized and hashed once per process. An open
  room is serialized from its live state.
- Artifacts are a cache: `.jollypixel/builds/<key>`, gitignored, safe to
  delete, never backed up with `events.db` and `objects/`. They go through the
  `AssetSource`, so the offline back-end keeps them in its persistent source
  with no store of its own.
- A kind with `parts` reads only its manifest from the source today; its
  build (step 5) must load the parts too.

### The whole project is the game

```ts
interface GameManifest {
  version: 1;
  start: string;
  assets: AssetManifestData;
  artifacts: Record<string, string>;
}
```

- Every catalog record the account opens goes into `assets` at its project
  path, and `artifacts` maps its ID to `builds/<id>/<revision>/<file name>`
  (`current` when a record has no revision). The player's `LoadingManager`
  URL modifier turns each project path into its build URL. Scripts load
  scenes by reference, so the start scene's dependency closure does not cover
  the game.
- Play builds lazily. `GET /api/game?start=<id>` builds nothing; the first
  request for an artifact builds it. It is cached as immutable while the
  requested revision is current, and served `no-store` otherwise, so a game
  loading a scene after an edit gets the new content without poisoning the
  cache.
- Artifact requests skip the API rate limit: a game loads hundreds of assets.
- Export builds every asset whose kind has a `build` hook, eagerly, and fails
  on the first error.
- A build failure answers with the asset path and the hook's message; the
  player shows it on its loading screen and forwards it to the studio console.

### The player runs in its own window

`window.open("/play/?start=<sceneId>", "jolly-play")` opens the player or
reloads the one already open. Unchanged artifacts come from the browser cache.

- The player page, `play/index.html` (`src/play/`), builds with the shell like
  the preview frame.
- It posts its errors to `window.opener` as `jolly-play-error`; the shell shows
  them as notifications. It accepts them from the window it opened, or from a
  same-origin window named `jolly-play`, so a studio reload keeps them.
- Online it fetches `../api/game/` with the session cookie and resolves each
  record path against that URL. Offline, Play is not offered yet (see open
  questions).
- `game.json` paths are relative to `game.json` itself, so a studio hosted
  under a subpath works and an export can use the same rule.

### Play control

A split button in `#studio-actions`, left of the account badge:

```
[ ▶ Play | ▾ ]  (avatar)
            ┌───────────────────────────────┐
            │ ▶ Play game             F5     │
            │ ▶ Play current scene    Ctrl+F5│
            │ ───────────────────────────── │
            │ ⚙ Set default scene…           │
            └───────────────────────────────┘
```

- It shows when the project has a default scene, or while a scene tab is
  active. Without a default scene, the main action plays the current scene.
- The tooltip names the scene: "Play Arena (F5)".
- "Play current scene" is enabled only when the active tab is a scene.
- "Set default scene…" opens Settings › Project › General, which holds a Game
  section with the Default scene select.
- The default scene is `{ "game": { "start": "<assetId>" } }` in
  `project.json`, saved through `PUT /api/project/settings/game` behind the
  settings right and written to `audit.db` like `kindFilter`. A start that is
  gone or not a scene is ignored, so the button falls back to the current
  scene or hides; the section is not cleared.
- F5 and Ctrl+F5 (Cmd+F5) are fixed shortcuts, like the console toggle: frames
  never receive the studio's keybinding scope. `forwardPlayShortcut` in
  `editor.host` calls `preventDefault()` and sends a `jolly-play` shell command
  from a frame, and calls `StudioPlay` directly in the shell.
- No spinner: the window opens at once and the player shows its own loading
  screen.

## Steps

Each step ends with the touched workspaces' tests, `pnpm run typecheck` and
`pnpm run lint` green.

### 1. Runtime contributions (done)

- `RuntimeComponentPackage` and `contributedRuntimeComponents` in
  `@jolly-pixel/runtime`.
- `virtual:jolly-pixel/contributions/runtime` needed no new code: the asset
  server's contributions plugin reads any `jollypixel.<field>`.
- `./runtime` entries for scene (built-ins), model, voxel-map and voxel-model,
  definitions only; each `SCENE_COMPONENTS` reuses those objects.
- Script waits for step 4, where its definition changes.
- The bundle guard.

### 2. Back-end builds (done)

- `AssetKindHandler.build`, `PASS_THROUGH_BUILD`, `AssetBackend.builds`
  (`AssetBuilds`) in `@jolly-pixel/asset-server`.
- `StudioGame` behind `GET /api/game` and
  `GET /api/game/builds/:assetId/:revision/:name`. An asset is visible when
  the role may join its room (`StudioAccess.opens`). Share-link guests have no
  account, so they cannot play. A failed build answers 422 `build-failed`.
- Pass-through builds for binary, texture, model and sound (through
  `binaryAssetKind`) and font. The scene build writes the expanded
  `SceneFile` the engine reads, not the compact stored one.

### 3. Player and Play (done, online only)

- Engine `SceneFileAssetType` + `SceneFileAssetLoader` in the default loaders.
- `RuntimeComponentPackage.setup(world)`; editor.scene's attaches the Rapier
  physics world, importing `physics.rapier` lazily.
- `play/index.html` (`GameManifestClient`, `GameScenes` loading the start
  scene and the prefab scenes it expands), the `jolly-play` window, errors as
  notifications.
- The `game` project section and its select, the split button, F5/Ctrl+F5 from
  the shell and from frames.
- Checked in the dev studio on a scratch project: a scene with camera, light
  and mesh plays; only the loaded scene is built; F5 in a frame reloads the
  game window, not the studio.
- Not done: offline transport (see open questions).

### 4. Scripts and shaders (done, online only)

- `AssetLoadContext.assets` (`@jolly-pixel/asset`): a loader loads the assets
  it depends on into the same coordinator and reads the catalog
  (`AssetCatalog.findByPath`, `AssetPath.resolve`).
- `game.json` keeps project paths, with an `artifacts` map; the player's URL
  modifier fetches builds.
- `script` and `shader` build hooks in `asset.script` (`#compiler`, Node only),
  `AssetBuild.type` in `asset-server`. One `ScriptImportPolicy` per kind
  checks the build and refuses links in the player.
- Engine `ScriptDefinition` reads `exports[behavior]` from its `script` slot
  (`SCRIPT_MODULE_ASSET`), the constructor record staying the fallback.
- `editor.script/runtime`: `ModuleRegistry` and `linkModule` shared with the
  shader editor, `ScriptModuleLoader`, `ShaderModuleLoader`.
- Checked in the dev studio: a decorated behavior importing a helper script
  spins a mesh with its scene property value; console lines point at the `.ts`
  source.

### 5. Voxel and pixel-art kinds (done for voxelmap, blockset, voxelmodel, pixelart)

- Builds: pass-through for pixelart, blockset and voxelmap; voxelmodel writes
  its expanded file.
- `editor.pixel-art/runtime` (`PIXEL_ART_DOCUMENT`, a `PixelDocument`),
  `editor.voxel-model/runtime` (`GameVoxelModel`, texture through the
  pixel-art loader), `editor.voxel-map/runtime` (`GameVoxelMap` reusing the
  viewer's `BlocksetSurface` and `BlocksetAtlasBridge`, `GameBlockset`).
- Checked in the dev studio: a map with its blockset atlas and a textured voxel
  model play next to a scripted mesh.
- Left out: voxelanimation, which the scene's voxel model does not play yet,
  and terrain, which has no scene component; each needs its component first.

### 6. Export

- Eager build, then `GET /api/project/game.zip` behind `studio.$export`: the
  built player, `game.json` with paths rewritten to `assets/<key>/<file name>`,
  and the artifacts. The file name stays last because the loading screen
  shows it.

## Open questions

- **Script import cycles.** Linking through `data:` modules refuses scripts
  that import each other by value. An import map from `game.json`, injected
  before the scripts load, would allow them with real URLs; it needs browsers
  to merge an import map added after the page's first module.
- **Offline transport.** Runtime loaders fetch URLs, and three.js's
  `LoadingManager.setURLModifier` is synchronous, so an artifact built on
  demand by the opener cannot be fetched as-is. Candidates: a service worker on
  `/play/` that asks the opener, or eager blob URLs for the start scene's
  closure. Step 3 shipped online only: `StudioPlay` exists for a signed-in
  studio, so the offline and static studios show no Play button yet. Scripts
  and shaders also build in Node only: an offline build needs a browser
  TypeScript compiler that handles legacy decorators.
- **Unknown kinds in a scene.** A scene that references a kind with no runtime
  loader (a terrain, a voxel animation) fails its whole load. Skipping such
  components with a warning would let the rest of the scene play.
- **Cache size.** No eviction in the first cut; deleting `.jollypixel/builds/`
  is the remedy. Add an LRU cap once a real project shows the size.
- **Models with sibling files.** A `.gltf` with an external `.bin` or an
  `.obj` with its `.mtl` loads the sibling by a path relative to its own. Since
  step 4 that path goes through the URL modifier, so a sibling that is an asset
  of the project should load; not checked yet. `.glb` and `.fbx` are
  self-contained.
- **Physics setup.** Loading Rapier's wasm for every game is a cost; the setup
  hook could attach the physics world only when a scene holds a RigidBody.
