---
"@jolly-pixel/engine": minor
---

Add `parseModel(content, fileName, options?)` to read a `.glb`, `.gltf`, `.fbx` or `.obj` model from bytes. `ModelAssetLoader` now fetches the file and parses it with `parseModel`.
Add `ModelDefinition` (`"Model"` scene component); `ModelRenderer` accepts a loaded `model` and `castShadow` / `receiveShadow`.
