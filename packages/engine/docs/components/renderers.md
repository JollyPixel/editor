# Renderers

The engine ships with four built-in renderer components. Each one
extends [ActorComponent](../actor/actor-component.md) and handles
loading, displaying, and cleaning up a specific type of visual
asset.

## ModelRenderer

Renders a 3D model loaded from an OBJ, FBX, or glTF file.
The model is added to the actor's Three.js group on `awake` and
removed on `destroy`.

```ts
import { Actor, ModelRenderer } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Knight" });
actor.addComponent(ModelRenderer, {
  path: "models/knight.glb",
  animations: {
    default: "idle",
    clipNameRewriter: (name) => name.toLowerCase()
  }
});
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `path` | — | Path to the model file (`.obj`, `.fbx`, `.glb`, `.gltf`) |
| `debug` | `false` | Log loaded object and animations to the console |
| `animations.default` | — | Name of the animation clip to play on start |
| `animations.clipNameRewriter` | identity | Transforms clip names before storing them |

Every `ModelRenderer` exposes an `animation` property that
controls clip playback with crossfade transitions:

```ts
const renderer = actor.addComponentAndGet(ModelRenderer, {
  path: "models/knight.glb"
});

renderer.animation.setFadeDuration(0.25);
renderer.animation.play("walk");
renderer.animation.stop();
```

## SpriteRenderer

Renders a 2D sprite from a spritesheet texture. Supports
frame-based animation, horizontal/vertical flipping, and opacity.

```ts
import { Actor, SpriteRenderer } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Player" });
actor.addComponent(SpriteRenderer, {
  texture: "textures/player.png",
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
| `texture` | — | Path to the spritesheet image |
| `tileHorizontal` | — | Number of columns in the spritesheet |
| `tileVertical` | — | Number of rows in the spritesheet |
| `animations` | `{}` | Named animation definitions (frame arrays or ranges) |
| `flip.horizontal` | `false` | Mirror the sprite horizontally |
| `flip.vertical` | `false` | Mirror the sprite vertically |

Runtime helpers:

```ts
const sprite = actor.addComponentAndGet(SpriteRenderer, {
  texture: "textures/hero.png",
  tileHorizontal: 6,
  tileVertical: 2,
  animations: { run: { from: 0, to: 5 } }
});

sprite.setFrame(3);
sprite.setHorizontalFlip(true);
sprite.setOpacity(0.8);
sprite.animation.play("run", { duration: 0.6, loop: true });
```

## TextRenderer

Renders 3D extruded text using a Three.js typeface font
(`.typeface.json`).

```ts
import * as THREE from "three";
import { Actor, TextRenderer } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Title" });
actor.addComponent(TextRenderer, {
  path: "fonts/roboto.typeface.json",
  text: "Hello World",
  material: new THREE.MeshStandardMaterial({ color: 0xffffff }),
  textGeometryOptions: { size: 2, depth: 0.5 }
});
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `path` | — | Path to the `.typeface.json` font file |
| `text` | `""` | Initial text to display |
| `material` | `MeshBasicMaterial` | Material applied to the text mesh |
| `textGeometryOptions` | `{ size: 1, depth: 1 }` | Three.js `TextGeometry` parameters |

To update the text at runtime, use the `text` property and call
`updateMesh()`:

```ts
const renderer = actor.addComponentAndGet(TextRenderer, {
  path: "fonts/roboto.typeface.json"
});

renderer.text.setValue("Score: 100");
renderer.updateMesh();
```

## See also

- [ActorComponent](../actor/actor-component.md)
- [Camera3DControls](camera-3d-controls.md)
- [Behavior](behavior.md)
- [Asset Loading](../asset.md)
