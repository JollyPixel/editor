# Renderers

Built-in [components](../actor/actor-component.md) that draw a model, a
sprite, text or a primitive mesh.

## ModelRenderer

Renders a 3D model (OBJ, FBX or glTF). Each renderer adds its own clone of
the model, skeletons included, sharing geometries and materials with the
asset, so several actors can use one model.

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

`animation` plays clips with crossfades:

```ts
const renderer = actor.addComponentAndGet(ModelRenderer, {
  asset: KnightModel
});

renderer.animation.setFadeDuration(0.25);
renderer.animation.play("walk");
renderer.animation.stop();
```

`animation.isAnimating` is `true` while a clip plays or fades; the renderer
only updates in that state.

## SpriteRenderer

Renders a 2D sprite from a spritesheet, with frame animation, flipping and
opacity.

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

- `duration` is the length of one cycle, in seconds of game time. A
  non-looping animation stops on its last frame and `isPlaying` becomes
  `false`.
- An unknown animation name logs a warning and changes nothing.
- `frameIndex` and `flip` are read-only; use `setFrame()` and the flip
  setters. Frames count left to right from the top row.
- `sheet` is the `SpriteSheet` built from the tile counts; it throws a
  `RangeError` for a count below 1 or not an integer.
  `sheet.writeFrame(texture, frame, flip)` sets a texture's `repeat` and
  `offset` to one cell.

## TextRenderer

Renders 3D extruded text from a Three.js typeface font (`.typeface.json`).

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

Change the text with `text.setValue()`, then call `updateMesh()`:

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
