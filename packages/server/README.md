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

The back-end of one JollyPixel project: its asset server, accounts, share
links, audit log, game builds and the `/api/` routes, served over HTTP and
WebSocket.

- `@jolly-pixel/server` holds what the browser and the server share: route
  tables, request and reply schemas, the project and editor manifests and the
  registry of preference scopes. It imports no Node.js builtin.
- `@jolly-pixel/server/node` holds the server itself: `StudioProject`,
  `StudioBackend` (middleware to mount in another HTTP server, such as Vite's)
  and `StudioServer` (a standalone HTTP server that also serves a built shell).
- `@jolly-pixel/server/testing` serves a backend on a free port, signs
  requests in with a cookie jar and builds editor page fixtures, for the
  server's specs and the studio's.

The server reads nothing next to its own files and ships no editor list. The
caller decides where the editor and kind packages resolve from, which project
file a new project starts with, which assets seed it, which built shell to
serve, which preference scopes that shell declares and which player game
exports ship. `StudioServerSettings` is the only reader of environment
variables.

## 👀 Usage example

```ts
import { NO_SHELL_PREFERENCES } from "@jolly-pixel/server";
import {
  StudioProject,
  StudioServer
} from "@jolly-pixel/server/node";

const project = await StudioProject.open("./my-game", {
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
});
const server = await StudioServer.open({
  project,
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
