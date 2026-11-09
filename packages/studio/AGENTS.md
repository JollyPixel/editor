# AGENTS.md

## Builds

- The dev server compiles editor pages (`jollypixel.editor.page`) from source,
  but every workspace dependency loads from `dist/`. After changing ui,
  editor.host, network, asset-server or an asset package, rebuild it, or run
  `pnpm run build:deps` to rebuild them all.
  `pnpm run dev:editors` watches ui, editor.host and the pixel-art lib.
- Game export ships the player from `dist/`, in dev too: run
  `pnpm run build:hosted` after changing `src/play/` or a runtime
  contribution, or the zip holds a stale player.
- Editors and kinds under `packages/editors` and `packages/assets` resolve by
  name from those folders (`StudioProject.resolver`). Add one to
  `package.json` only when studio code imports it, so the `^...` filter skips
  the others: rebuild with `build:deps`.

## Project

- `project/` is gitignored. Its `.jollypixel/project.json` is written once from
  `DEFAULT_PROJECT_FILE` (`server/project/StudioProject.ts`); a new editor or
  kind reaches an existing local project only when added there by hand.
- A new API surface is a route table in `shared/api/` plus a Fastify plugin
  registered in `server/api/StudioApi.ts`.
- On Windows, a recursive `fs.watch` fires `change` when a file is read. A
  watcher must compare mtime and size before treating an event as a rebuild,
  as `server/editors/DistSnapshot.ts` does.
