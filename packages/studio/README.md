<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

Private app that opens each asset of one project in its editor page. Its back-end, `@jolly-pixel/server`, runs one asset back-end ([`@jolly-pixel/asset-server`][asset-server]) for every editor, with the accounts and the HTTP API. Design notes live in [ARCHITECTURE.md](./ARCHITECTURE.md) and the [ADRs](./docs/adr/README.md).

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

The dev server compiles each editor page from source and bundles the workspace packages they import, such as `@jolly-pixel/ui` and `editor.host`, from `dist/` when it starts. A rebuilt package reaches the studio only after a dev server restart. The watch builds of ui, `editor.host` and the pixel-art library keep their `dist/` current:

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
