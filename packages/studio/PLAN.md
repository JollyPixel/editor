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

The `script` build hook strips types (SWC wasm in the browser,
`node:module` in Node) and rewrites imports with es-module-lexer:

- Another script, `./Enemy.ts`, becomes `jolly-script:<assetId>`. An import
  names an asset ID, never content, so editing `Enemy.ts` leaves
  `Player.ts` built.
- `@jolly-pixel/engine`, `three`, `three/webgpu` and `three/tsl` stay bare. The
  player resolves them to its own copies, so scripts and components share one
  engine and one three.js.
- Any other import fails the build and names the specifier. npm dependencies
  in scripts are out of scope.

The game's `script` loader imports the module and returns its exports.
`ScriptDefinition.create` takes `exports[data.behavior]` from the slot value,
so two scripts may both export `Player`. The editor keeps `ScriptOutline` as
its slot value: the script package declares two `AssetType`s on the `script`
kind, one per side.

### Artifacts and their key

```ts
interface AssetBuild<TState> {
  readonly version: string;

  build(state: TState, content: Uint8Array): Promise<Uint8Array>;
}
```

- An artifact keeps the asset's extension, and its media type comes from the
  handler's `extensions`: the engine's model loader picks GLTF, FBX or OBJ by
  extension. A kind whose artifact needs another extension (scripts, `.js`)
  adds an output extension to the hook in step 4.
- Key: `sha256(kind, build.version, contentHash(content))`.
- Another asset never enters the artifact. A voxel map loader asks the
  coordinator for its blockset; a prefab stays a scene `FileScene` expands.
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
}
```

- Every catalog record the account opens goes into `assets`, with `path` set
  to `/api/game/builds/<id>/<revision>/<file name>` (`current` when a record
  has no revision). Scripts load scenes by reference, so the start scene's
  dependency closure does not cover the game.
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

### 4. Scripts

- The `script` build hook and loader, `ScriptDefinition` reading behaviors from
  the slot.
- The resolution of bare and `jolly-script:` specifiers in the player.

### 5. Voxel and pixel-art kinds

One kind per step, a build hook and a loader each: voxelmap, blockset,
voxelmodel, voxelanimation, pixelart, terrain. Until then those components
render in the editor only, as `editor.scene`'s ROADMAP says.

### 6. Export

- Eager build, then `GET /api/project/game.zip` behind `studio.$export`: the
  built player, `game.json` with paths rewritten to `assets/<key>.<ext>`, and
  the artifacts.

## Open questions

- **Script specifier resolution.** An import map generated from `game.json` is
  the cleanest, but it must exist before the player's first module loads, and
  Vite hashes chunk names. The fallback is the registry shim `ShaderModule`
  already uses (`Symbol.for("jolly-pixel.shader.modules")` plus generated
  modules). Spike at the start of step 4.
- **Offline transport.** Runtime loaders fetch URLs, and three.js's
  `LoadingManager.setURLModifier` is synchronous, so an artifact built on
  demand by the opener cannot be fetched as-is. Candidates: a service worker on
  `/play/` that asks the opener, or eager blob URLs for the start scene's
  closure. Step 3 shipped online only: `StudioPlay` exists for a signed-in
  studio, so the offline and static studios show no Play button yet.
- **Unknown kinds in a scene.** A scene that references a kind with no runtime
  loader yet (a voxel map before step 5) fails its whole load. Skipping such
  components with a warning would let the rest of the scene play.
- **Cache size.** No eviction in the first cut; deleting `.jollypixel/builds/`
  is the remedy. Add an LRU cap once a real project shows the size.
- **Models with sibling files.** A `.gltf` with an external `.bin` or an
  `.obj` with its `.mtl` loads the sibling by a relative URL, which a build
  path does not serve. `.glb` and `.fbx` are self-contained.
- **Physics setup.** Loading Rapier's wasm for every game is a cost; the setup
  hook could attach the physics world only when a scene holds a RigidBody.
