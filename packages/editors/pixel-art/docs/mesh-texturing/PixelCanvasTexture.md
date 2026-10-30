# PixelCanvasTexture

Mirrors a live pixel-draw canvas onto a `THREE.CanvasTexture` and batches the
uploads.

```ts
import { PixelCanvasTexture } from "@jolly-pixel/editor.pixel-art/mesh-texturing";

const bridge = new PixelCanvasTexture(canvas);
const material = new THREE.MeshStandardMaterial({
  map: bridge.texture,
  transparent: true
});
```

The source is any object with `document`, `textureSize` and `textureCanvas()`
(`PixelTextureSource`). `PixelArtCanvas` is one.

## Options

```ts
interface PixelCanvasTextureOptions {
  filter?: "nearest" | "linear"; // "nearest", both mag and min
  colorSpace?: THREE.ColorSpace; // THREE.SRGBColorSpace
  flush?: "frame" | "immediate" | "manual"; // "frame"
  scheduler?: (callback: () => void) => void; // requestAnimationFrame
}
```

- `frame` uploads at most once per animation frame.
- `immediate` uploads on every change.
- `manual` never uploads by itself; call `consume()`.

## Events

```ts
interface PixelCanvasTextureEvents {
  resized: { size: Vec2 }; // buffer resize or texture replacement
  "normal-map-toggled": { enabled: boolean };
}
```

Both `resized` cases mark the whole texture dirty.

## Methods

### consume(): SelectionRect | null

Applies pending changes and returns the union of dirty rectangles since the last
call, or `null` when nothing changed.

```ts
const dirty = bridge.consume();
if (dirty !== null) {
  blockset.updateSourceRegion(image, dirty);
}
```

### normalTexture(): THREE.DataTexture | null

The texture of a [`NormalMapTexture`](./NormalMapTexture.md) over the
document's normal map, created on first call. Returns `null` while the document has no normal map
settings; turning them off disposes it.

```ts
material.normalMap = bridge.normalTexture();
bridge.on("normal-map-toggled", () => {
  material.normalMap = bridge.normalTexture();
  material.needsUpdate = true;
});
```

### dispose(): void

Detaches from the source and disposes the textures. Idempotent.
