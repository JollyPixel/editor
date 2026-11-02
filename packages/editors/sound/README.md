## 📌 About

Private editor workspace for `@jolly-pixel/asset.sound` sounds, booted through `@jolly-pixel/editor.host`.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.sound dev
```

The dev server seeds a short generated chime under `assets/`; delete that directory to seed it again. Other sounds are imported through the studio.

`window.soundEditor.player` exposes the player from the console.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.sound test
$ pnpm --filter @jolly-pixel/editor.sound typecheck
$ pnpm --filter @jolly-pixel/editor.sound lint
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
