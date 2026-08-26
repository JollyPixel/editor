# PixelCanvasTexture

Mirrors a live pixel-draw canvas onto a `THREE.CanvasTexture` and batches the uploads. Handles the parts every call site used to hand-roll: nearest filtering, no mipmaps, `needsUpdate` on change, and re-pointing `image` when the working canvas element is swapped out.

```ts
import { PixelCanvasTexture } from "@jolly-pixel/editor.pixel-art/three/index.ts";

const bridge = new PixelCanvasTexture(canvas);
const material = new THREE.MeshStandardMaterial({
  map: bridge.texture,
  transparent: true
});
```

The source is structural — `document`, `textureSize` and `textureCanvas()`. `PixelArtCanvas` satisfies it; so does a stub.

## Options

| Option | Default | |
|---|---|---|
| `filter` | `"nearest"` | Applied to both `magFilter` and `minFilter`. |
| `colorSpace` | `THREE.SRGBColorSpace` | |
| `flush` | `"frame"` | `"frame"`, `"immediate"` or `"manual"` — see below. |
| `scheduler` | `requestAnimationFrame` | Overridable; tests inject a queue they drain by hand. |

`colorSpace` is a behavior change from the hand-rolled textures this replaces, which left it unset. sRGB is the correct value for a pixel-art canvas; colors shifting after adopting the bridge is that default, not a regression.

## Flush modes

`"frame"` uploads at most once per animation frame no matter how many pixels changed in between — this is the mode you want for a brush stroke, where the alternative is one upload per pixel.

`"immediate"` uploads on every change. `"manual"` never uploads on its own and hands the schedule to the caller, which is what a consumer already running its own frame loop wants.

## `consume()`

```ts
consume(): SelectionRect | null
```

Applies whatever is pending and returns the union of the dirty rectangles accumulated since the last call, or `null` when nothing changed. The bounds are the point: a consumer that has to do real work per update — repadding an atlas, rescanning blocks — can restrict it to the area a stroke actually touched.

```ts
function onFrame() {
  const dirty = bridge.consume();
  if (dirty !== null) {
    tileset.updateSourceRegion(image, dirty);
  }
}
```

## Events

`resized` carries the new `{ size }` after either a buffer resize or a texture replacement. Consumers holding their own copy of the texture size re-read it here. Both cases also mark the whole texture dirty.

## `dispose()`

Detaches the source subscriptions, drops any scheduled flush and disposes the texture. Idempotent.
