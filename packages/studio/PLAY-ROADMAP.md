# Play and build a game: roadmap

Play, the back-end builds and the game export are built, for a signed-in
studio only. The terms are in the [glossary](./GLOSSARY.md) (game manifest,
default scene, player, game export).

Topics are ordered from the easiest to the hardest. The size is a rough
effort: S is a day, M a few days, L a week, XL several weeks. Each step ends
with the touched workspaces' tests, `pnpm run typecheck` and `pnpm run lint`
green.

## 1. Export size (M, then L)

**Spec.** Step 1: the export streams, so memory holds about one artifact at a
time instead of the whole zip. Step 2: the export holds only the assets the
game can reach, with an opt-in to include every asset for scripts that load
assets by ID.

Today `GameExport` builds every buildable asset and zips them in memory with
`zipSync`.

**Plan.**

1. Stream with fflate's `Zip` into the reply as each asset builds. A build
   error after the first bytes are sent aborts the response, so the export
   checks the default scene and the player before it starts streaming.
2. Compute the closure from the default scene, every scene, prefabs,
   component slots and script imports. A script switches scenes with a
   [scene ref](./GLOSSARY.md#scene-ref) string the export cannot read, so
   every scene stays and the closure drops unused non-scene assets only.

## 2. Script import cycles (L)

**Spec.** Scripts that import each other by value play, online and in an
export. Each script loads from a real URL instead of a `data:` module, so its
imports need no URL before its own exists.

The import map is written into the player page before its first module:
several import maps per page work in Chrome 133 and Safari 18.4 but not yet
in Firefox, and the page route avoids depending on a polyfill.

**Plan.**

1. Scripting: the player build emits one static module per allowed bare
   specifier (`three`, `three/webgpu`, `three/tsl`, `@jolly-pixel/engine`),
   re-exporting the namespace the player registers, in place of the
   `ModuleRegistry` `data:` shims.
2. Server: build an import map from the game manifest. Each script's project
   URL, in the forms `scriptAt` accepts (`x`, `x.ts`, `x.js`), maps to its
   artifact URL, and each bare specifier to its player module.
3. Studio Play: a server route serves `/play/` with the map injected; in dev
   it takes the HTML from Vite's `transformIndexHtml`, as editor pages do.
4. Export: `exportedPlayerPage`, which `BuiltPlayer` and `DevPlayer` share,
   injects the same map into `index.html`, next to the `jolly-game` meta.
5. `ScriptModuleLoader` imports the script's project URL and drops
   `linkModule` and the cycle check.
6. Tests: the map for a catalog, and a unit test of the HTML injection. Two scripts importing each other need a real browser: one e2e
   in the player suite.

## 3. Offline Play and export (XL, after 2)

**Spec.** The offline and static studios show Play and Export game. The game
runs from the in-browser back-end with the same player code as online.

Two gaps: loaders fetch URLs, and the URL modifier is synchronous, so an
artifact built on demand by the opener cannot be returned from it. And scripts
build in Node only. Shaders already build in the browser (SWC strip-only).

**Plan.**

1. A service worker scoped to `/play/` answers the player page (with the
   import map of topic 2), `game.json` and `builds/*` by asking the opener
   window through the clients API and a `MessageChannel`. The opener's
   offline back-end builds the artifact. The first load is not controlled by
   the worker, so the player reloads once after it activates. Service workers
   need https or localhost.
2. Scripting: the `#compiler` browser entry imports `typescript` on the first
   script build and runs the same `transpileModule` call as Node, so output
   and diagnostics match. Measure the chunk size first.
3. Game export offline: the shell zips the player from its own static build
   and the artifacts from the offline back-end, through the same
   `GameExport` logic moved to a browser-safe module.
4. `StudioPlay` and the Export game action stop depending on `user.online`.
5. One e2e: offline Play of a scene with a script.
