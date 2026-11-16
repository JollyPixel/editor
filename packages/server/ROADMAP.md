# @jolly-pixel/server — ROADMAP

Open work, in the order it should land.

Each step ends with `pnpm --filter @jolly-pixel/server test`,
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

## Next steps

### 1. Several projects in one server

One process serves one project today, and the studio's `docs/hosting.md` asks
for one process per project behind a router. The goal is one server that hosts
several projects and opens each on demand, which a desktop app also needs. The
studio stays the front of one project.

Nobody runs the studio in production yet: schemas and URLs break freely, with
no migration and no import of existing `accounts.db` files.

#### Levels

- **Server level.** The HTTP listener and its `upgrade` listener, the
  accounts (identity, sessions, avatars, preferences, the server owner), the
  registry of projects, the shell and the projects page.
- **Project level.** The asset server and its rooms, `project.json`, the
  access section, the project's membership realm, the audit log, share links,
  agent tokens, the game build and export, and the archive.

#### Decisions

- **Identity.** `project.json` carries a UUID `id`, written the first time the
  server opens the project. It keys every project row of the server database.
  A project's slug defaults to its folder name and is unique within a server.
  Two folders with the same `id` refuse to open the second.
- **Registry.** `ProjectRegistry` maps slugs to roots, with `add`, `remove`,
  `resolve(slug)` and `list()`. Three sources fill it:
  - `JOLLY_PROJECTS=<dir>`: every subfolder holding
    `.jollypixel/project.json`, read on resolve so a new folder needs no
    restart.
  - `JOLLY_PROJECT=<dir>`: a single project, as today.
  - The desktop app, which calls `add` and `remove` at run time.

  The server state folder is `<dir>/.jollypixel/` with `JOLLY_PROJECTS`, the
  project's own `.jollypixel/` with `JOLLY_PROJECT`, and a typed `state`
  option for the desktop app.
- **Addressing.** A project lives under `/p/<slug>/`: shell `index.html`,
  `project-manifest.json`, the project API, `/view/<token>`, `/play/`, share
  pages, asset content and its socket at `/p/<slug>/ws-sync`. The root keeps
  `/api/accounts/`, `/api/projects`, the shell's hashed files and the built
  editor pages. A single project mounts at `/`, so its URLs do not change.
  The studio resolves the socket from `document.baseURI` instead of
  `location.host`, and the golem from its `studioUrl`.
- **Accounts.** `@jolly-pixel/accounts` splits identity from membership, in one
  SQLite database:
  - `Accounts` holds users, sessions, avatars, preferences and the server
    owner. The cookie name hashes the server state folder.
  - `accounts.realm(id, { roles, join })` returns an `AccountsRealm`, one per
    open project. It authenticates with the realm's role and owns the roster
    extension, role changes, holders, pending requests, share links and agent
    tokens. Tables gain `memberships(realm_id, user_id, role, status)` and a
    `realm_id` column on `share_links` and `agent_tokens`.
  - Removing an account or changing its profile emits once on `Accounts`, and
    every open realm reacts.
- **Admission.**
  - Registration only happens from a project: one transaction creates the
    identity and its membership, so no account exists without a project.
  - `access.join` in `project.json` replaces `accessRequests`:
    - `request` (the default) creates a pending membership that the project's
      admins approve with a role.
    - `open` grants `defaultRole` at once.
    - `invite` refuses before any identity is created, and admins add members
      by username.
  - Signing in is server-wide. A signed-in account entering a project it does
    not belong to joins, requests or is told to ask for an invitation, in
    place.
  - The first account, which needs `JOLLY_MASTER_PASSWORD` when set, owns the
    server and is an admin of every project. The crown and its transfer move to
    server level, and the per-project ownership row goes away. Requests no
    longer need a master password.
  - A project admin's removal drops the membership. Only the server owner
    deletes an account.
  - Joins, role changes and approvals go to the project's `audit.db`.
- **Editors.** The shell build is the server's editor set. A project listing an
  editor the shell lacks fails at open, alone, and its `/p/<slug>/` names the
  missing editors. The preferences route stays per project and checks scopes
  against the shell and that project's editors; storage is per account,
  server-wide.
- **Lifetime.** `OpenProjects` opens a project on its first request or socket
  upgrade, sharing one opening between concurrent requests and caching no
  failure. A project closes after 10 minutes with no socket and no request; a
  request during the close waits and reopens it. There is no cap on open
  projects. A single project follows the same rule. `registry.remove` closes the
  project and drops its sockets; memberships stay.
- **Projects page.** In `JOLLY_PROJECTS` mode, `/` serves a page of the studio
  build: a sign-in form when signed out, then the account's projects and
  pending requests from `GET /api/projects`. Nothing lists projects an account
  does not belong to, except for the server owner, who sees every project with
  the ones that fail to open marked.
- **Creation.** The server owner creates a project from the projects page:
  `POST /api/projects` writes `<dir>/<slug>/` from the template and seed the
  caller passes. Deleting a project, renaming its slug and importing an archive
  as a new project happen on disk or later.
- **HTTP.** One Fastify app for the server. Under `/p/:slug/api/`, an
  `onRequest` hook opens the project and sets `request.project`. Rate limiting
  and the cross-origin check apply per server.
- **Sockets.** `WebsocketTransport` takes an upgrade handed to it instead of
  only listening on its own path. `ServerBackend` owns the one `upgrade`
  listener, opens the project and hands the socket to its transport.
- **Vite dev.** Mounts `ServerBackend` with a single project, or a projects
  folder through `JOLLY_PROJECTS`.

#### Names

The `Studio` prefix goes, each name changing once:

- Project level: `StudioProject` → `Project`, `StudioAccess` →
  `ProjectAccess`, `StudioShares` → `ProjectShares`, `StudioGame` →
  `ProjectGame`, and the new `ProjectBackend`, the part of
  `StudioBackend.open` that one project owns.
- Server level: `StudioBackend` → `ServerBackend`, `StudioServer` →
  `JollyServer`, `StudioServerSettings` → `ServerSettings`, `StudioApi` →
  `ServerApi`, and the new `ProjectRegistry` and `OpenProjects`.

#### Steps

1. ~~**Accounts.**~~ **Done.** `Accounts` and `AccountsRealm` in
   `@jolly-pixel/accounts`. Until step 2, the server opens one realm keyed by
   the project root and maps `accessRequests` to the `request` or `open` join
   mode.
2. **One project behind the new levels.** Rename to the `Project*` names, add
   `id` to `project.json` and `access.join`, and key the realm by that `id`.
   Extract `ProjectBackend` and serve it at `/` from `ServerBackend` and
   `ServerApi`, with no change in behavior.
3. **Socket hand-off.** The upgrade hand-off in `@jolly-pixel/network` and the
   `upgrade` listener of `ServerBackend`.
4. **Several projects.** `ProjectRegistry`, `OpenProjects` with the idle close,
   `/p/<slug>/` routing, `JOLLY_PROJECTS`, the server state folder and
   `JollyServer`.
5. **Studio.** The socket URL from `document.baseURI`, registration and joining
   from a project page, the Users pane (membership removal, crown at server
   level) and the golem URLs. The accounts package still lacks
   `AccountsRealm.join` for a signed-in account, the `invite` command that
   adds a member by username, and account deletion by the server owner.
6. **Projects page.** The page, `GET /api/projects` and `POST /api/projects`.
7. **Docs.** The studio's `hosting.md` and `accounts.md`, the API docs and
   glossaries of `accounts`, `network` and `server`, and this roadmap.
