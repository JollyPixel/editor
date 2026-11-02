## 📌 About

Private asset workspace for fonts (kind `font`). A font asset is a Three.js typeface JSON file (`.typeface.json`), the format the engine's `FontAssetLoader` reads and the scene editor's Text component draws with.

- Dropping a `.ttf`, `.otf` or `.woff` file in the studio converts it to typeface JSON with [opentype.js](https://github.com/opentypejs/opentype.js). The original file is not kept. WOFF2 is not supported.
- Fonts are read-only: no editor opens them, and the studio's New asset menu does not offer them (`creatable: false`).
- A client reads a font from its room snapshot: `fontDocumentKind()` from `@jolly-pixel/asset.font/client` gives a `FontDocument` whose `typeface` is `null` until the snapshot arrives.

Browser code imports `@jolly-pixel/asset.font/client`. The package root pulls in server dependencies and loads opentype.js only when a conversion runs.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.font build
```

Editors load the built `dist/` output, so rebuild after a change before running them.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.font test
$ pnpm --filter @jolly-pixel/asset.font lint
```

Tests build their font files with opentype.js instead of shipping font binaries.

## License

MIT
