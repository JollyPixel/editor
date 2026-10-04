# Config

`defineE2EConfig()` builds the Playwright config of a suite. `PORTS` gives each
suite its dev server port. `prebundleWorkspace()` pre-bundles the workspace
packages its page loads.

## `defineE2EConfig(options): PlaywrightTestConfig`

```ts
// Import Third-party Dependencies
import {
  PORTS,
  defineE2EConfig
} from "@jolly-pixel/e2e";

export default defineE2EConfig({
  port: PORTS.voxelMap,
  command: "pnpm run dev:e2e",
  ciWorkers: 2,
  viewport: {
    width: 960,
    height: 540
  }
});
```

Specs live in `test/e2e/**/*.e2e.ts`, so `node --test` (which globs
`*.spec.ts`) never picks them up. Tests run fully parallel on 4 workers with a
`retain-on-failure` trace, and the dev server has 60 seconds to answer. The result is a plain config object; spread it to
override anything else.

| Option | Default | |
|---|---|---|
| `port` | | dev server port, also the `baseURL` |
| `command` | | starts the dev server |
| `ciWorkers` | `4` | workers when `CI` is set |
| `viewport` | Playwright's | |
| `reuseExistingServer` | `!CI` | |

On CI a failed test retries once.

## Ports

`PORTS` gives each suite its own port, so dev servers can run side by side:
`pixelArt` 3000, `ui` 3001, `voxelMap` 3002, `voxelModel` 3003, `studio` 3004,
`runtime` 3005, `console` 3006. Vite configs read the same table for
`server.port`.

`baseUrl(port)` gives `http://localhost:<port>`.

## `prebundleWorkspace(): Plugin`

```ts
// Import Third-party Dependencies
import { defineConfig } from "vite";
import {
  PORTS,
  prebundleWorkspace
} from "@jolly-pixel/e2e";

export default defineConfig({
  server: {
    port: PORTS.voxelModel
  },
  plugins: [
    prebundleWorkspace()
  ]
});
```

A Vite plugin that runs only on `vite --mode e2e`. Before the dependency
optimizer starts, it follows the module scripts of the root `index.html`
through the server's own resolution, local files and virtual modules
included (such as
`virtual:jolly-pixel/handlers`), and adds every `@jolly-pixel/*` specifier
they import to `optimizeDeps.include`, with `force: true`. It skips
`import type` and `export type`, but keeps `import { type X }`, which still
loads the module. It never reads `node_modules` nor the packages it lists:
anything those import is bundled with them.
