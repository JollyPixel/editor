# @jolly-pixel/server — ROADMAP

Open work, in the order it should land.

Each step ends with `pnpm --filter @jolly-pixel/server test`,
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

## Next steps

### 1. Per-project contributions in Vite dev

Vite dev with `JOLLY_PROJECTS` builds its player and kind modules from the
studio's own project, so a project with other kind packages plays with the
wrong contributions in dev. The hosted build is unaffected.

### 2. Browser tests for the multi-project pages

The projects page, the "Join this project" dialog and the Users pane actions
(remove from project, delete account, transfer ownership) have no browser
test yet; the server specs cover their routes.

### 3. Unavailable projects on the projects page

The projects page marks a project unavailable only when its `project.json`
cannot be read. Other opening failures, such as an editor the shell lacks or a
duplicate `id`, show only on the project's own pages.

### 4. Project management from the projects page

Deleting a project, renaming its slug and importing an archive as a new
project happen on disk while the server is stopped.
