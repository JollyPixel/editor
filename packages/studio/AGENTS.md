# AGENTS.md

## Builds

- The dev server compiles editor pages (`jollypixel.editor.page`) from source,
  but every workspace dependency loads from `dist/`. After changing ui,
  editor.host, network, asset-server or an asset package, rebuild it, or run
  `pnpm --filter "@jolly-pixel/studio^..." run build` to rebuild them all.
  `pnpm run dev:editors` watches ui, editor.host and the pixel-art lib.

## Project

- `project/` is gitignored. Its `.jollypixel/project.json` is written once from
  `DEFAULT_PROJECT_FILE` (`server/project/StudioProject.ts`); a new editor or
  kind reaches an existing local project only when added there by hand.
- A new API surface is a route table in `shared/api/` plus a Fastify plugin
  registered in `server/api/StudioApi.ts`.
- On Windows, a recursive `fs.watch` fires `change` when a file is read. A
  watcher must compare mtime and size before treating an event as a rebuild,
  as `server/editors/DistSnapshot.ts` does.
