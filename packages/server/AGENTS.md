# AGENTS.md

## Boundaries

- The root entry (`src/index.ts`) and its concern folders are browser-safe:
  the studio shell bundles them, and lint refuses `node:` builtins and
  `src/node/` imports there. Node.js code lives in `src/node/`, test helpers
  in `src/testing/`.
- A concern keeps its contract in `src/<concern>/` and its server code in
  `src/node/<concern>/`. `src/node/http/` holds only the Fastify app and its
  error mapping.
- The server never locates files relative to itself and ships no editor list.
  Its caller passes the shell folder, the project template, the seed, the
  game player, the shell's preference scopes and the package folders; the
  studio does it from `node/studioFiles.ts`. Only `src/testing/` resolves
  `asset.voxel-map` from this package's own install, for its fixture project.
- Only `StudioServerSettings` reads environment variables. Everything else
  takes typed options, such as the accounts' `masterPassword`.
- A new API surface is a route table in `src/<concern>/api.ts` plus a Fastify
  plugin in `src/node/<concern>/routes.ts`, registered in
  `src/node/http/StudioApi.ts`.
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
