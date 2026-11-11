## 📌 About

Private asset workspace for three text kinds:

- `script`: a `.ts` or `.js` file, created from a `Behavior` template.
- `shader`: a `.tsl.ts` file (it wins over `.ts`), created from a template that returns a `MeshStandardNodeMaterial`.
- `text`: a `.md`, `.txt`, `.json`, `.jsonc`, `.yml`, `.yaml`, `.toml`, `.xml`, `.html` or `.css` file, created empty.

All three load as UTF-8 with LF line endings and share one edit protocol:

- An edit is `{ at, insert }` or `{ at, delete }` in UTF-16 offsets. The room rebases it over the edits committed since its `basis` version and keeps the last 1,000.
- An edit based on an older version, or whose deleted text no longer matches, is refused; its author resyncs from the snapshot.
- `ScriptDocument` holds the text and a local undo history that never reverts a peer's edit.

Scripts have an outline: each `Behavior` class with its `@SceneProperty` fields. Request it with `ScriptOutlineFeed.request()`; only a Node server answers.

Scripts and shaders build to `text/javascript` with `buildScript` or `buildShader` from `@jolly-pixel/scripting`. A refused import, a dynamic import or a syntax error fails the build. Scripts build in Node only.

Browser code imports `@jolly-pixel/asset.script/client`; the package root pulls in server dependencies.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.script build
```

Tests and editors load this package and `@jolly-pixel/scripting` from `dist/`, so build both first: `pnpm --filter "@jolly-pixel/asset.script..." build`.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.script test
$ pnpm --filter @jolly-pixel/asset.script lint
```

Convergence specs drive several clients against a real `LiveAssetRoom` and use fast-check to replay random edits, undos and deliveries.

## License

MIT
