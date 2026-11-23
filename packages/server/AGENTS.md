# AGENTS.md

## Boundaries

- A concern lives in `src/<concern>/`. Its root files are browser-safe (the
  studio shell bundles them through `src/index.ts`): `api.ts` holds only the
  route table and the request and reply schemas, model files hold the rest.
  Its Node.js code lives in `src/<concern>/node/`. Lint refuses `node:`
  builtins and `node/` imports outside `node/` folders and `src/testing/`.
- In a concern's `node/`, `routes.ts` is the HTTP edge: it calls the domain
  objects and exports the table mapping their errors to statuses. Page
  middlewares (`SharePage`, `PlayPage`, `ManifestRoute`) are the other edge.
  A failure table another transport needs lives in the concern root, as
  `game/gameFailures.ts` does for offline Play.
  Lint lets only `routes.ts`, `src/http/node/` and `ServerApi` import Fastify.
- `src/http/` is the transport shared by every concern: the wire contract in
  `api.ts`, and in `node/` authentication, the error fallback, downloads and
  the middleware helpers. It imports no other concern.
- `src/server/node/` only assembles: `ServerBackend` (server level),
  `ProjectBackend` (one open project), `JollyServer`, `ServerSettings` and
  `ServerApi`, the Fastify app. `src/projects/` is the server-level concern:
  hosting, the registry, open projects and `/api/projects/`.
- Route plugins take their domain objects as `RequestScoped` accessors, so
  one plugin serves every open project; `ServerApi` reads them from
  `request.project`.
- The server never locates files relative to itself and ships no editor list.
  Its caller passes the shell folder, the project template, the seed, the
  game player, the shell's preference scopes and the package folders; the
  studio does it from `node/studioFiles.ts`. Only `src/testing/` resolves
  `asset.voxel-map` from this package's own install, for its fixture project.
- Only `ServerSettings` reads environment variables. Everything else
  takes typed options, such as the accounts' `masterPassword`.
- A new API surface is a route table in `src/<concern>/api.ts` plus a Fastify
  plugin in `src/<concern>/node/routes.ts`. `src/server/node/ServerApi.ts`
  registers the plugin and its failure table.
- Test helpers another workspace needs go in `src/testing/` (the `./testing`
  entry); helpers only this package's specs use stay in `test/helpers/`.

## Builds

- Consumers load `dist/`. After a change, run
  `pnpm --filter @jolly-pixel/server build` and restart the studio dev server.

## Gotchas

- Specs open a voxel-map and voxel-model project in memory through
  `test/helpers/testProject.ts`, which resolves the first-party packages from
  `packages/assets` and `packages/editors` and seeds from
  `test/fixtures/blockset.png`, a copy of the studio's
  `public/textures/blockset.png`.
