---
"@jolly-pixel/engine": minor
---

`parseModel` loads the `.mtl` libraries an `.obj` file names in `mtllib`, and keeps default materials when one fails to load. `ModelAssetLoader` no longer requires `<name>.mtl` beside an `.obj`.
An `.obj` file with no `usemtl` takes the image of the same name beside it as its texture (`texture` option, `modelTextureNames`).
