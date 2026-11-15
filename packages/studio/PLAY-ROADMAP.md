# Play and build a game: roadmap

Play, the back-end builds and the game export are built, for a signed-in
studio only. The terms are in the [glossary](./GLOSSARY.md) (game manifest,
default scene, player, game export).

Each step ends with the touched workspaces' tests,
`pnpm run typecheck` and `pnpm run lint` green.

## 1. Offline Play and export

**Spec.** The offline and static studios show Play and Export game. The game
runs from the in-browser back-end with the same player code as online.

Two gaps: loaders fetch URLs, and the URL modifier is synchronous, so an
artifact built on demand by the opener cannot be returned from it. And scripts
build in Node only. Shaders already build in the browser (SWC strip-only).

**Plan.**

1. A service worker scoped to `/play/` answers the player page, `game.json`,
   `builds/*` and `modules/*` by asking the opener window through the clients
   API and a `MessageChannel`. The opener's offline back-end builds the
   artifact. It writes the page's import map with `PlayerPage` and
   `scriptImports` from `@jolly-pixel/server`, as the online server does. The
   first load is not controlled by the worker, so the player reloads once
   after it activates. Service workers need https or localhost.
2. Scripting: the `#compiler` browser entry imports `typescript` on the first
   script build and runs the same `transpileModule` call as Node, so output
   and diagnostics match. Measure the chunk size first.
3. Game export offline: the shell zips the player from its own static build
   and the artifacts from the offline back-end, through the same
   `GameExport` logic moved to a browser-safe module.
4. `StudioPlay` and the Export game action stop depending on `user.online`.
5. One e2e: offline Play of a scene with a script.
