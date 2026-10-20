# Config

`defineE2EConfig()` builds the Playwright config of a suite. `PORTS` gives each
suite its dev server port. `prebundleWorkspace()` pre-bundles the workspace
packages its page loads. `RunMode` answers what a `vite.config.ts` needs to
know about the current mode.

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
`*.spec.ts`) never picks them up. Tests run fully parallel on 4 workers, and
the dev server has 60 seconds to answer. The result is a plain config object;
spread it to override anything else.

| Option | Default | |
|---|---|---|
| `port` | | dev server port, also the `baseURL` |
| `command` | | starts the dev server |
| `ciWorkers` | `4` | workers when `CI` is set |
| `localWorkers` | `4` | workers when `CI` is not set, a count or a share of the CPU cores such as `"50%"` |
| `viewport` | Playwright's | |
| `reuseExistingServer` | `!CI` | |

Tracing is off locally: recording every test made the voxel-map suite about
30% slower. Rerun a failure with `--trace=on` to get its trace. On CI a failed
test retries once, and only the retry records a trace: tracing slows a test
enough to hide races, so the first attempt runs at full speed.

## Ports

`PORTS` gives each suite its own port, so dev servers can run side by side:
`pixelArt` 3000, `ui` 3001, `voxelMap` 3002, `voxelModel` 3003, `studio` 3004,
`runtime` 3005, `console` 3006, `lantern` 3007, `terrain` 3008. Vite configs
read the same table for `server.port`.

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

[`RunMode.plugins()`](#plugins-plugin) already includes it. Add it by hand
only to a config without `RunMode`, such as the `@jolly-pixel/ui` gallery's.

## `RunMode`

Reads Vite's `command` and `mode` once and hands a `vite.config.ts` the
finished pieces: server options, the shared plugins and the asset workspace
options.

```ts
// Import Third-party Dependencies
import { defineConfig } from "vite";
import {
  PORTS,
  RunMode
} from "@jolly-pixel/e2e";

export default defineConfig(async(env) => {
  const mode = new RunMode(env, { port: PORTS.voxelMap });
  const projectFile = await ProjectFile.open(
    kAssetsRoot,
    kProjectFile,
    mode.workspace
  );

  return {
    server: mode.server,
    plugins: [
      mode.plugins(),
      createAssetWorkspacePlugin({
        root: kAssetsRoot,
        ...mode.workspace
      })
    ]
  };
});
```

### `new RunMode(env: ConfigEnv, options: { port: number })`

`port` is the suite's `PORTS` entry, used only by `vite --mode e2e`.

### `e2e: boolean`

`true` for `--mode e2e`, whether serving or building.

### `serve: boolean`

`true` for `vite` and `vite --mode <mode>`, `false` for `vite build`.

### `server: ServerOptions`

`{ port, strictPort: true }` in e2e, so Playwright finds the server on the
suite port, and `{ allowedHosts: true }` otherwise.

### `workspace: RunModeWorkspace`

Spread into `createAssetWorkspacePlugin`, or pass to `ProjectFile.open`. The
fields come from `AssetWorkspaceOptions` of `@jolly-pixel/asset-server/node`,
made required.

```ts
interface RunModeWorkspace {
  inMemory: boolean;
  auth: CookieAuthentication | undefined;
  rights: RightsMap;
  defaultRole: string;
}
```

`inMemory` is `true` for e2e and for every build: a test run and a build
never read or write the workspace on disk. Every connection is a `member`
that writes everything; a `spectator` reads and may only join and share
presence. In e2e, `auth` is a
[`CookieAuthentication`](./roles.md#cookieauthentication), so a suite picks
the role per browser context. Outside e2e, `auth` is `undefined`.

### `plugins(): Plugin[]`

`prebundleWorkspace()`, the precompress plugin and, in e2e only, the revoke
endpoint of `workspace.auth`. Each plugin checks the mode itself, so the list
is safe to add to every config.

The precompress plugin runs only on `vite build`. Once the bundle is written,
it writes a brotli (`.br`, maximum quality) and a gzip (`.gz`, level 9) copy
next to every `.css`, `.html`, `.js`, `.json`, `.mjs`, `.svg` and `.wasm`
file of the bundle that weighs 1 KB or more. Files copied from `publicDir`
are not part of the bundle and stay uncompressed. The studio serves these
copies to clients that accept them; see the studio's
[Hosting](../../studio/docs/hosting.md).
