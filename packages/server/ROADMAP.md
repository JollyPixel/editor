# @jolly-pixel/server — ROADMAP

Open work, in the order it should land.

Each step ends with `pnpm --filter @jolly-pixel/server test`,
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

## Next steps

### 1. Several projects in one server

One process serves one project today. `StudioBackend.open(project, options)`
opens everything at once, and the studio's `docs/hosting.md` asks for one
process per project behind a router. The goal is one server that hosts
several projects and opens each on demand, which a desktop app also needs.
The studio stays the front of one project.

`StudioBackend` mixes two levels that have to come apart first:

- **Server level.** The HTTP listener and the WebSocket transport, the
  accounts with their sessions and preferences, and the shell with its editor
  pages.
- **Project level.** The asset server and its rooms, `project.json`, the
  access section with its roles and rights, the audit log, share links, the
  game build and export, and the archive.

Single-project hosting then becomes a server with one entry, and must keep
working unchanged.

The exports still carry the `Studio` prefix of the workspace they came from
(`StudioProject`, `StudioBackend`, `StudioServer`, `StudioAccess`,
`StudioShares`, `StudioGame`). Rename them when this
split decides which level each one belongs to, not before, so each name
changes once.

Questions to settle before building:

- **Accounts.** `accounts.db` sits in each project's state folder, next to
  `audit.db`, and holds accounts, sessions, preferences and share links. The
  session cookie name is a hash of the project root. Moving accounts to the
  server level means roles, which `project.json` defines per project, point
  at server-wide accounts. Share links stay per project, since they name an
  asset. Existing projects need their `accounts.db` merged or kept.
- **Addressing.** Routes move under a project, such as `/api/projects/:id/`,
  or a host picks the project. The socket either stays one `/ws-sync` path
  with project-scoped room names, or gets one path per project.
- **Editors.** `project.json` lists the editors, but a built shell compiles
  the pages of the editors it was built with, and `StudioServer.open`
  refuses a project whose editor page is missing. Either the server's editor
  set becomes the union of its projects, or a project may only list editors
  the server ships.
- **Lifetime.** Rooms live in memory and each project keeps SQLite files
  open. Projects open on the first request and close after an idle delay,
  as rooms already close five minutes after their last client leaves.
- **Registry.** How the server finds its projects: a folder of projects, a
  list in a server file, or folders a desktop app adds at run time.
