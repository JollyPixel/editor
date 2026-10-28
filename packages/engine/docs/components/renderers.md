# Renderers

The engine ships with four built-in renderer components. Each one
extends [ActorComponent](../actor/actor-component.md) and handles
loading, displaying, and cleaning up a specific type of visual
asset.

## ModelRenderer

Renders a 3D model loaded from an OBJ, FBX, or glTF file.
On `awake`, a clone of the loaded model (skeletons included) is added
to the actor's Three.js group, so several actors can share one model
asset. The clone shares geometries and materials with the asset and
is detached on `destroy` without disposing them.

```ts
import { Actor, ModelRenderer } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Knight" });
actor.addComponent(ModelRenderer, {
  asset: KnightModel,
  animations: {
    default: "idle",
    clipNameRewriter: (name) => name.toLowerCase()
  }
});
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `asset` | — | Typed model reference declared by the owning scene |
| `debug` | `false` | Log loaded object and animations to the console |
| `animations.default` | — | Name of the animation clip to play on start |
| `animations.clipNameRewriter` | identity | Transforms clip names before storing them |

Every `ModelRenderer` exposes an `animation` property that
controls clip playback with crossfade transitions:

```ts
const renderer = actor.addComponentAndGet(ModelRenderer, {
  asset: KnightModel
});

renderer.animation.setFadeDuration(0.25);
renderer.animation.play("walk");
renderer.animation.stop();
```

`animation.isAnimating` is `true` while a clip plays or fades. The
renderer only requests updates in that state: `play()`, `resume()` and a
fading `stop()` turn them on, and they turn off once nothing is left to
animate.

## SpriteRenderer

Renders a 2D sprite from a spritesheet texture. Supports
frame-based animation, horizontal/vertical flipping, and opacity.

```ts
import { Actor, SpriteRenderer } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Player" });
actor.addComponent(SpriteRenderer, {
  texture: PlayerSpritesheet,
  tileHorizontal: 8,
  tileVertical: 4,
  animations: {
    walk: { from: 0, to: 7 },
    jump: [8, 9, 10, 11]
  }
});
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `texture` | — | `AssetReference<THREE.Texture>` declared by the owning scene (for example with `TEXTURE_ASSET`). Each sprite renders a clone, so frames and flips never leak between sprites |
| `tileHorizontal` | — | Number of columns in the spritesheet, a positive integer |
| `tileVertical` | — | Number of rows in the spritesheet, a positive integer |
| `animations` | `{}` | Named animation definitions (frame arrays or ranges) |
| `flip.horizontal` | `false` | Mirror the sprite horizontally |
| `flip.vertical` | `false` | Mirror the sprite vertically |

Runtime helpers:

```ts
const sprite = actor.addComponentAndGet(SpriteRenderer, {
  texture: HeroSpritesheet,
  tileHorizontal: 6,
  tileVertical: 2,
  animations: { run: { from: 0, to: 5 } }
});

sprite.setFrame(3);
sprite.setHorizontalFlip(true);
sprite.setOpacity(0.8);
sprite.animation.play("run", { duration: 0.6, loop: true });
```

`duration` is the length of one full cycle, in seconds. Playback
advances with the frame `deltaTime`. A non-looping animation stops on
its last frame and `isPlaying` becomes `false`. The sprite only requests
updates while `isPlaying` is `true`. Playing an unknown animation name
logs a warning through `world.logger` and changes nothing.

`frameIndex` and `flip` are read-only; change them with `setFrame()` and
the flip setters. `sheet` is the `SpriteSheet` built from the tile counts.
Its constructor throws a `RangeError` for a count below 1 or not an
integer, and `writeFrame(texture, frame, flip)` sets the texture's `repeat`
and `offset` to one cell. Frames count left to right from the top row.

## TextRenderer

Renders 3D extruded text using a Three.js typeface font
(`.typeface.json`).

```ts
import * as THREE from "three";
import { Actor, TextRenderer } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Title" });
actor.addComponent(TextRenderer, {
  asset: RobotoFont,
  text: "Hello World",
  material: new THREE.MeshStandardMaterial({ color: 0xffffff }),
  textGeometryOptions: { size: 2, depth: 0.5 }
});
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `asset` | — | Typed font reference declared by the owning scene |
| `text` | `""` | Initial text to display |
| `material` | `MeshBasicMaterial` | Material applied to the text mesh |
| `textGeometryOptions` | `{ size: 1, depth: 1 }` | Three.js `TextGeometry` parameters |

To update the text at runtime, use the `text` property and call
`updateMesh()`. `text.ensureMesh()` rebuilds the geometry when the value,
font or options changed, and returns the mesh:

```ts
const renderer = actor.addComponentAndGet(TextRenderer, {
  asset: RobotoFont
});

renderer.text.setValue("Score: 100");
renderer.updateMesh();
```

## MeshRenderer

Renders a primitive geometry with a `MeshStandardMaterial`. It needs no
asset.

```ts
import { Actor, MeshRenderer } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Ball" });
actor.addComponent(MeshRenderer, {
  geometry: {
    kind: "sphere",
    radius: 0.5,
    widthSegments: 32,
    heightSegments: 16
  },
  material: { color: "#ff8800", roughness: 0.4 },
  castShadow: true
});
```

```ts
interface MeshRendererOptions {
  geometry?: MeshGeometry; // a 1x1x1 box
  material?: {
    color?: THREE.ColorRepresentation; // "#ffffff"
    roughness?: number; // 1
    metalness?: number; // 0
    emissive?: THREE.ColorRepresentation; // "#000000"
    emissiveIntensity?: number; // 1
    opacity?: number; // 1, transparent below 1
    flatShading?: boolean; // false
  };
  castShadow?: boolean; // false
  receiveShadow?: boolean; // false
}
```

`MESH_RENDERER_DEFAULTS` holds these defaults.

`MeshGeometry` is a union over `kind` (`box`, `sphere`, `plane`, `cylinder`,
`cone`, `torus`, `capsule`). Its other fields are the size and segment
parameters of the matching three.js geometry constructor.
`MESH_GEOMETRY_DEFAULTS` maps each kind to a geometry with default
parameters.

### configure(options): this

Merges `options` into the current settings, field by field for `material`,
and writes them to the live mesh. A geometry with different parameters
replaces the current one, which is disposed; the material is updated in
place.

## See also

- [ActorComponent](../actor/actor-component.md)
- [Camera3DControls](camera-3d-controls.md)
- [Behavior](behavior.md)
- [Asset Loading](../asset.md)
