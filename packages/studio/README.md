<h1 align="center">
  Studio
</h1>

<p align="center">
  One JollyPixel project, its assets and one editor per tab
</p>

## 📌 About

Private dev app that serves one asset back-end ([`@jolly-pixel/asset-server`][asset-server]) for every editor and opens each asset in its editor page. Design notes live in [ARCHITECTURE.md](./ARCHITECTURE.md) and the [ADRs](./docs/adr/README.md).

## 🚀 Running the studio

```bash
$ pnpm install
$ pnpm -r build
$ pnpm --filter @jolly-pixel/studio dev
```

The project root defaults to `project/`, seeded on first boot. Set `JOLLY_PROJECT` to open another directory. Restart the dev server after editing `.jollypixel/project.json`.

| Query parameter | Effect |
|---|---|
| `?offline` | Run the asset back-end in the browser (IndexedDB) |

To pick up editor, host or ui changes while the studio runs, start the watch builds in a second terminal:

```bash
$ pnpm --filter @jolly-pixel/studio dev:editors
```

For static hosting, build without an asset server and serve `dist/`:

```bash
$ pnpm --filter @jolly-pixel/studio build:static
```

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
