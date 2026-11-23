# Play and build a game: roadmap

Play, the back-end builds and the game export are built, for a signed-in
studio only. The terms are in the [glossary](./GLOSSARY.md) (game manifest,
default scene, player, game export).

Each step ends with the touched workspaces' tests,
`pnpm run typecheck` and `pnpm run lint` green.

## 1. Offline Play and export

Built. The offline and static studios show Play and Export game, and the game
runs with the same player code as online. See Offline Play in the
[glossary](./GLOSSARY.md).

- The play worker (`play/sw.js`) relays the play window's requests to the
  tab that owns the offline back-end, over a `BroadcastChannel`, not to the
  opener: a second studio tab joins as a guest and cannot build. The owner
  answers from the back-end's `serve` hook with `PlayableGame` and
  `GameArchive`, which moved out of the server's `node/` folders.
- The shell registers the worker when it starts offline, so a play window is
  usually controlled from its first load; otherwise it reloads once.
- Scripts build with `typescript` in Node and in the browser alike; ts-morph
  stays for the outliner.
- The offline default scene and physics live in `localStorage`, edited in
  Settings › Project › General.
- The export ships the player from `play/player.zip`, written by
  `build:static` and served by `DevPlayer` under `pnpm dev`.
- One e2e plays an offline scene with two scripts.
