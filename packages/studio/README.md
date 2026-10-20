<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

Private app that serves one asset back-end ([`@jolly-pixel/asset-server`][asset-server]) for every editor and opens each asset in its editor page. Design notes live in [ARCHITECTURE.md](./ARCHITECTURE.md) and the [ADRs](./docs/adr/README.md).

## 🚀 Running the studio

```bash
$ pnpm install
$ pnpm -r build
$ pnpm --filter @jolly-pixel/studio dev
```

The project root defaults to `project/`, seeded on first boot. A missing `.jollypixel/project.json` is written with every key at its default value. Set `JOLLY_PROJECT` to open another directory. The packages `.jollypixel/project.json` lists resolve from the project's `node_modules`, then from the studio's; an entry starting with `./` names a folder of the project. The dev server restarts when that file changes.

| Query parameter | Effect |
|---|---|
| `?offline` | Run the asset back-end in the browser (IndexedDB) |

To pick up editor, host or ui changes while the studio runs, start the watch builds in a second terminal:

```bash
$ pnpm --filter @jolly-pixel/studio dev:editors
```

## 👤 Accounts

The online studio asks everyone to sign in. [docs/accounts.md](./docs/accounts.md) covers roles, the master password and how admins manage accounts.

## 🌐 Hosting

The studio ships as a static build without accounts, or as one Node.js server per project behind a TLS reverse proxy. [docs/hosting.md](./docs/hosting.md) covers both builds and the server's environment variables.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/studio test
$ pnpm --filter @jolly-pixel/studio typecheck
$ pnpm --filter @jolly-pixel/studio lint
$ pnpm exec playwright install chromium
$ pnpm --filter @jolly-pixel/studio test:e2e
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../CONTRIBUTING.md
[asset-server]: ../asset-server/README.md
