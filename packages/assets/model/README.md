## 📌 About

Private asset workspace for 3D models (kind `model`). A model asset is a `.glb`, `.gltf`, `.fbx` or `.obj` file stored as is; the model editor previews it and plays its animations.

- The file is a single asset. The external files it points to (an `.obj` file's `.mtl` libraries, a `.gltf` file's `.bin` buffers, textures) are assets of their own: import them at the path the model names, relative to its folder. The model editor, the scene editor, Play and the game export load them from there.
- An `.obj` file with no `usemtl` line takes the image of the same name beside it as its texture: `Sphere.png` for `Sphere.obj` (`.png`, `.jpg`, `.jpeg` or `.webp`).
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
