# NormalMapTexture

A `THREE.DataTexture` over a `NormalMap`. [`PixelCanvasTexture.normalTexture()`](./PixelCanvasTexture.md)
uses it for a document's own normal map; build one directly for another normal
map, such as a blockset's.

```ts
import { NormalMapTexture } from "@jolly-pixel/editor.pixel-art/mesh-texturing";

const normal = new NormalMapTexture(normals);
material.normalMap = normal.texture;

normal.dispose();
```

```ts
class NormalMapTexture {
  readonly texture: THREE.DataTexture;

  constructor(normals: NormalMap);
  dispose(): void;
}
```

- The constructor retains and flushes the normal map.
- The texture uses `NoColorSpace`, `NearestFilter`, no mipmaps and `flipY`, so
  it shares UVs with the albedo canvas texture.
- It follows the map's `changed` and `resized` events.
- `dispose()` stops following, releases the map and disposes the texture.
