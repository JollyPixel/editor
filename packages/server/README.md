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

## 💡 About

The back-end of JollyPixel projects: one project at `/`, or a folder of them
under `/p/<slug>/`. Accounts belong to the server; each project brings its
asset server, members, share links, audit log, game builds and `/api/` routes,
served over HTTP and WebSocket. A project opens on its first request and
closes after 10 minutes without one.

- `@jolly-pixel/server` holds what the browser and the server share: route
  tables, request and reply schemas, the project and editor manifests and the
  registry of preference scopes. It imports no Node.js builtin.
- `@jolly-pixel/server/node` holds the server itself: `Project`,
  `ProjectHosting` (which projects the server hosts and where its own state
  lives), `ServerBackend` (middleware and an `upgrade` listener to mount in
  another HTTP server, such as Vite's) and `JollyServer` (a standalone HTTP
  server that also serves a built shell).
- `@jolly-pixel/server/testing` serves a backend on a free port, signs
  requests in with a cookie jar and builds editor page fixtures, for the
  server's specs and the studio's.

The server reads nothing next to its own files and ships no editor list. The
caller decides where the editor and kind packages resolve from, which project
file a new project starts with, which assets seed it, which built shell to
serve, which preference scopes that shell declares and which player game
exports ship. `ServerSettings` is the only reader of environment
variables.

## 👀 Usage example

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

The studio's `node/start.ts` is the hosted entry built this way.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/server test
$ pnpm --filter @jolly-pixel/server lint
```

The studio's `test/api/` specs drive the audit, preferences and project
routes through the shell's API clients.

## License

MIT
