# AGENTS.md

## Builds

- The dev server compiles editor pages (`jollypixel.editor.page`) from source,
  but every workspace dependency loads from `dist/`. After changing ui,
  editor.host, network, server, asset-server or an asset package, rebuild it,
  or run `pnpm run build:deps` to rebuild them all.
  `pnpm run dev:editors` watches ui, editor.host and the pixel-art lib.
- Editors and kinds under `packages/editors` and `packages/assets` resolve by
  name from those folders (`openStudioProject` in `node/studioFiles.ts`). Add
  one to `package.json` only when studio code imports it, so the `^...` filter
  skips the others: rebuild with `build:deps`.
- Open the project with `openStudioProject` and take the backend's seed and
  shell preferences from `studioBackendFiles`: a bare `Project.open`
  gets no package folders and an empty template.
- Game export ships the player from `dist/` (`BuiltPlayer`), except under
  `pnpm dev`: `vite/DevPlayer.ts` builds it from the sources on the first
  export and again once a module it imports changes.
- The back-end serves `/play/`, not Vite (`vite/ServedPlayerPage.ts` under
  `pnpm dev`), to write the scripts into the player's import map. A bare
  specifier a script may import needs a module in `src/play/modules/` and an
  entry in `PLAYER_MODULES` (`vite/playerModules.ts`).
- On Windows, a recursive `fs.watch` fires `change` when a file is read. A
  watcher must compare mtime and size before treating an event as a rebuild,
  as `vite/DistSnapshot.ts` does.

## Project

- `project/` is gitignored. Its `.jollypixel/project.json` is written once from
  `STUDIO_PROJECT_FILE` (`node/projectTemplate.ts`); a new editor or kind
  reaches an existing local project only when added there by hand.
- `test/api/` drives the server's routes through the studio's API clients; the
  server's own specs call its routes with `fetch`.
