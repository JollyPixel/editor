# Config

`defineE2EConfig()` builds the Playwright config of a suite. `PORTS` gives each
suite its dev server port.

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
`*.spec.ts`) never picks them up. Tests run fully parallel with a
`retain-on-failure` trace. The result is a plain config object; spread it to
override anything else.

| Option | Default | |
|---|---|---|
| `port` | | dev server port, also the `baseURL` |
| `command` | | starts the dev server |
| `workers` | `4` | |
| `ciWorkers` | `workers` | workers when `CI` is set |
| `viewport` | Playwright's | |
| `serverTimeout` | `60_000` | ms the dev server may take to answer |
| `reuseExistingServer` | `!CI` | |

On CI a failed test retries once.

## Ports

`PORTS` gives each suite its own port, so dev servers can run side by side:
`pixelArt` 3000, `ui` 3001, `voxelMap` 3002, `voxelModel` 3003, `studio` 3004.
Vite configs read the same table for `server.port`.

- `baseUrl(port)`: `http://localhost:<port>`.
- `socketUrl(port)`: the sync server websocket, `ws://localhost:<port>/ws-sync`.
