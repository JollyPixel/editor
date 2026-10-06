# NormalMapTexture

A `THREE.DataTexture` over a [`NormalMap`](../../../../pixel-draw-renderer/docs/normal/NormalMap.md) output. [`PixelCanvasTexture.normalTexture()`](./PixelCanvasTexture.md#normaltexture) uses it for a document's own normal map; build one directly for a normal map with other islands, such as a blockset's.

```ts
import { NormalMapTexture } from "@jolly-pixel/editor.pixel-art/mesh-texturing";

const normal = new NormalMapTexture(normals);
material.normalMap = normal.texture;

normal.dispose();
```

```ts
new NormalMapTexture(normals: NormalMap)
```

The constructor retains the normal map and flushes it, so `texture` holds the current map. The texture uses `NoColorSpace`, `NearestFilter`, no mipmaps and `flipY`, like a canvas texture over the albedo.

`changed` marks the texture for upload. `resized` points it at the new pixels and disposes its GPU copy.

## `texture`

```ts
readonly texture: THREE.DataTexture
```

## `dispose()`

```ts
dispose(): void
```

Stops following the normal map, releases it and disposes the texture.
