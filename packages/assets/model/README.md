## 📌 About

Private asset workspace for 3D models (kind `model`). A model asset is a `.glb`, `.gltf`, `.fbx` or `.obj` file stored as is; the model editor previews it and plays its animations.

- The file is a single asset. External files it points to (an `.obj` file's `.mtl`, a `.gltf` file's `.bin` buffers, FBX textures outside the file) are not imported, so use self-contained files.
- A model file weighs at most 64 MB. The kind option `maxFileMb` sets another limit, from 1 to 128 MB, and the catalog refuses a larger create or replace.
- Models are read-only and the studio's New asset menu does not offer them (`creatable: false`).
- A client reads a model from its room snapshot: `modelFileDocumentKind()` from `@jolly-pixel/asset.model/client` gives a `ModelFileDocument` whose `bytes` are `null` until the snapshot arrives.

Browser code imports `@jolly-pixel/asset.model/client`.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.model build
```

Editors load the built `dist/` output, so rebuild after a change before running them.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.model test
$ pnpm --filter @jolly-pixel/asset.model lint
```

## License

MIT
