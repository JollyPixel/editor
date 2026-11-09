# Play and build a game: open questions

Play, the back-end builds and the game export are built. The terms are in the
[glossary](./GLOSSARY.md) (game manifest, default scene, player, game export).
What follows is still open.

- **Offline transport.** Runtime loaders fetch URLs, and three.js's
  `LoadingManager.setURLModifier` is synchronous, so an artifact built on
  demand by the opener cannot be fetched as-is. Candidates: a service worker on
  `/play/` that asks the opener, or eager blob URLs for the start scene's
  closure. `StudioPlay` exists for a signed-in studio only, so the offline and
  static studios show no Play button and no game export. Scripts and shaders
  also build in Node only: an offline build needs a browser TypeScript
  compiler that handles legacy decorators.
- **Script import cycles.** Linking through `data:` modules refuses scripts
  that import each other by value. An import map from `game.json`, injected
  before the scripts load, would allow them with real URLs; it needs browsers
  to merge an import map added after the page's first module.
- **Unknown kinds in a scene.** A scene that references a kind with no runtime
  loader (a terrain, a voxel animation) fails its whole load. Skipping such
  components with a warning would let the rest of the scene play.
  Voxelanimation and terrain each need their scene component first.
- **Cache size.** No eviction in the first cut; deleting `.jollypixel/builds/`
  is the remedy. Add an LRU cap once a real project shows the size.
- **Models with sibling files.** A `.gltf` with an external `.bin` or an
  `.obj` with its `.mtl` loads the sibling by a path relative to its own,
  through the URL modifier, so a sibling that is an asset of the project
  should load; not checked yet. `.glb` and `.fbx` are self-contained.
- **Physics setup.** Loading Rapier's wasm for every game is a cost; the setup
  hook could attach the physics world only when a scene holds a RigidBody.
- **Export in dev.** The export ships the player from `dist/`, which `pnpm dev`
  never rebuilds. Building the player on demand from the dev server would
  remove the stale-player trap.
- **Export size.** The zip is built in memory (`zipSync`) and holds every
  buildable asset, used or not. A large project may want streaming, or a
  closure from the default scene plus the scenes scripts load.
