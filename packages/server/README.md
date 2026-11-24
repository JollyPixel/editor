## 📌 About

The back-end of JollyPixel projects. It hosts one project at `/`, or a folder
of projects under `/p/<slug>/`, and serves each one over HTTP and WebSocket:
its asset server, members, share links, audit log, game builds and `/api/`
routes. Accounts belong to the server, not to a project.

- `@jolly-pixel/server`: what the browser and the server share. Route tables,
  request and reply schemas, the project and editor manifests and the registry
  of preference scopes. It imports no Node.js builtin.
- `@jolly-pixel/server/client`: browser clients for the golem chat and the
  open-assets channel.
- `@jolly-pixel/server/node`: the server itself.
- `@jolly-pixel/server/testing`: helpers for the server's specs and the
  studio's.

## 💃 Getting Started

This workspace-private package is never published. The studio depends on it:

```json
{
  "dependencies": {
    "@jolly-pixel/server": "workspace:*"
  }
}
```

Consumers load the built `dist/` output, so run
`pnpm --filter @jolly-pixel/server build` after a change.

## 👀 Usage example

### Standalone

`JollyServer` is an HTTP server that answers the API and serves a built shell:

```ts
import { NO_SHELL_PREFERENCES } from "@jolly-pixel/server";
import {
  JollyServer,
  Project,
  ProjectHosting
} from "@jolly-pixel/server/node";

const server = await JollyServer.open({
  hosting: ProjectHosting.folder("./games"),
  openProject: (root) => Project.open(root, {
    packages: {
      searchFolders: ["./packages/assets", "./packages/editors"]
    },
    template: {
      version: 1,
      editors: ["@jolly-pixel/editor.voxel-map"],
      kinds: {
        "@jolly-pixel/asset.voxel-map": {}
      }
    }
  }),
  shell: "./studio/dist",
  backend: {
    preferences: NO_SHELL_PREFERENCES
  }
});
console.info(`Listening on ${await server.listen(3000, "127.0.0.1")}`);
```

The shell folder holds the built `index.html`, the `project-manifest.json` of
the packages it was compiled with and the editor pages under `editors/<name>/`.
A project that lists an editor or kind package missing from that manifest does
not open.

### Inside another HTTP server

`ServerBackend` is the same back-end without the HTTP server. Mount its
`middleware`, which calls `next()` for any request it does not answer, and
`attach()` it to receive the WebSocket upgrades:

```ts
import http from "node:http";
import { NO_SHELL_PREFERENCES } from "@jolly-pixel/server";
import {
  BuiltPlayer,
  Project,
  ProjectHosting,
  ServerBackend
} from "@jolly-pixel/server/node";

const player = new BuiltPlayer("./studio/dist");
const backend = await ServerBackend.open({
  hosting: ProjectHosting.single("./my-game"),
  openProject: (root) => Project.open(root),
  player,
  playPage: player,
  preferences: NO_SHELL_PREFERENCES
});

const httpServer = http.createServer((request, response) => {
  backend.middleware(request, response, () => {
    response.statusCode = 404;
    response.end();
  });
});
backend.attach(httpServer);
httpServer.listen(3000);
```

In a Vite plugin, pass `backend.middleware` to `server.middlewares.use()` and
`server.httpServer` to `attach()`. The studio's dev server does this.

## 🗂️ Projects

`ProjectHosting` decides which projects the server hosts and where its own
state lives:

- `ProjectHosting.single(root)` serves one project at `/`. The server's state
  shares the project's `.jollypixel/` folder.
- `ProjectHosting.folder(directory)` serves each subfolder holding a
  `.jollypixel/project.json` at `/p/<folder name>/`. A folder added while the
  server runs answers without a restart. The server's state lives in
  `<directory>/.jollypixel/`.

The server's state holds the accounts. The first account to register owns the
server: it is an admin of every project, and only it creates, imports, renames
or deletes projects through `/api/projects/`.

A project opens on its first request or socket and closes after 10 minutes
without one (`idleMs`, `null` to keep it open). `openProject` opens it: the
caller decides where its editor and kind packages resolve from and which
project file a new project starts with (`template`).

The server reads nothing next to its own files and ships no editor list. The
caller also passes the assets that seed a new project (`seed`), the built
shell, the shell's preference scopes and the player that builds game exports.

## ⚙️ Configuration

`ServerSettings` is the only reader of environment variables. It throws a
`TypeError` listing every invalid one:

```ts
import { ServerSettings } from "@jolly-pixel/server/node";

const settings = ServerSettings.parse(process.env);
const hosting = settings.hosting(process.cwd());
```

- `PORT`, `HOST`: where to listen. `settings.port` and `settings.host` carry
  them to `listen()`.
- `JOLLY_PROJECT`: the folder of a single project, resolved against the base
  passed to `hosting()`.
- `JOLLY_PROJECTS`: a folder of projects instead. Set one of the two, not both.
- `JOLLY_MASTER_PASSWORD`: the password the first registration must give,
  passed on as `accounts.masterPassword`.
- `JOLLY_ALLOWED_HOSTS`: comma-separated hostnames accepted on a WebSocket
  upgrade, besides localhost and IP addresses (`allowedHosts`).
- `JOLLY_TRUST_PROXY`: `true`, or comma-separated proxy addresses and CIDR
  ranges whose `X-Forwarded-For` and `X-Forwarded-Proto` the API believes
  (`trustProxy`).
- `JOLLY_SOCKET_COMPRESSION`: `false` to send socket messages uncompressed
  (`compression`).

## 🌐 Routes

Each project answers these paths at `/`, or under `/p/<slug>/` with
`ProjectHosting.folder`:

- `/ws-sync`: the WebSocket of the asset server and presence.
- `/api/accounts/`: registration, sign-in and sessions.
- `/api/project/`: the signed-in account's rights, the project's settings and
  sections, and the archive download.
- `/api/shares/`: share links, opened under `/view/`.
- `/api/audit/`: the audit log.
- `/api/game/`: game builds and exports.
- `/api/preferences/`: the account's preferences, read at once and replaced
  one scope at a time.
- `/api/golem/tokens/`: tokens that let an AI agent join the project.
- `/project-manifest.json`, `/editors/<name>/` and `/play/`: the project's
  manifest and pages.

With `ProjectHosting.folder`, `/` redirects to the `/projects/` page, and
`/api/projects/` lists, creates, imports, renames and deletes the hosted
projects.

## 🧪 Testing helpers

`@jolly-pixel/server/testing` runs a back-end on a free port of `127.0.0.1`,
for the server's specs and the studio's:

```ts
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";
import { PROJECT_URL_PATH } from "@jolly-pixel/server";
import { listenBackend } from "@jolly-pixel/server/testing";

await using backend = await listenBackend(project, {});
const page = backend.browser();
await page.client.register("Alice", "p".repeat(43));

const response = await page.fetch(new URL(`.${PROJECT_URL_PATH}`, backend.url));
```

- `listenBackend(project, options)` serves one open `Project` in memory, with
  open registration and the `"member"` default role unless `join` and
  `defaultRole` say otherwise. A request the back-end does not answer gets a
  `418` (`PASSED_ON_STATUS`). It returns the `url`, `accountsUrl` and
  `socketUrl` to reach it.
- `browser(accountsUrl)` returns an `AccountsClient` and a `fetch` that share a
  cookie jar. `signedInSocket(socketUrl, browser)` opens a WebSocket with that
  jar's cookies.
- `voxelMapProject`, `voxelMapEditor`, `createDist` and `listen` build editor
  page fixtures, resolving `@jolly-pixel/asset.voxel-map` from this package's
  install.

## ✨ Contributors guide

Read the [contributing guide][contributing] before submitting a change, and the
workspace's `AGENTS.md` for where a concern's code goes.

Run these commands from the monorepo root:

```bash
$ pnpm --filter @jolly-pixel/server test
$ pnpm --filter @jolly-pixel/server lint
```

The studio's `test/api/` specs drive the audit, preferences and project routes
through the shell's API clients.

> [!CAUTION]
> Include tests when adding a feature or fixing a bug.

## 📃 License

MIT

<!-- Reference-style links -->

[contributing]: ../../CONTRIBUTING.md
