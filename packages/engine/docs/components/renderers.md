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
| `model` | — | An already loaded model, used instead of `asset` |
| `debug` | `false` | Log loaded object and animations to the console |
| `castShadow` | as loaded | Set on every mesh of the clone |
| `receiveShadow` | as loaded | Set on every mesh of the clone |
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

### ModelDefinition

The scene file definition of type `"Model"`. Its `model` asset slot takes a
`model` asset, and it builds no component until that asset resolves.

```ts
interface ModelSettings {
  animation: string; // "", the clip played in play mode
  castShadow: boolean; // false
  receiveShadow: boolean; // false
}
```

`MODEL_DEFAULTS` holds these defaults. In edit mode the model keeps its
rest pose, and a clip the model does not have plays nothing.

Its data also takes `uniforms` (`ModelData`) and it has a second asset slot,
`shader`, read as for [MeshDefinition](#meshdefinition). `ModelRenderer`
then takes `shader` and `uniforms` options: it builds one material and gives
it to every mesh of its model copy, and disposes it with the component. The
source model's materials are left alone.

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

Renders 3D extruded text from a Three.js typeface font (`.typeface.json`)
with a `MeshStandardMaterial`.

```ts
import { Actor, TextRenderer } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Title" });
const title = actor.addComponentAndGet(TextRenderer, {
  asset: RobotoFont,
  text: "Hello World",
  size: 2,
  depth: 0.5,
  material: { color: "#ffcc00" }
});

title.configure({ text: "Score: 100" });
```

```ts
type TextRendererOptions = TextShapeOptions & MeshSurfaceOptions & (
  | { asset: AssetReference<Font>; } // resolved when the actor awakes
  | { font?: Font | null; } // null
);

interface TextShapeOptions {
  text?: string; // "", "\n" starts a new line
  size?: number; // 1
  depth?: number; // 0.2, extruded along local Z
  curveSegments?: number; // 12
  bevel?: boolean; // false
  bevelThickness?: number; // 0.05
  bevelSize?: number; // 0.02
  align?: "left" | "center" | "right"; // "center"
}
```

`MeshSurfaceOptions` holds the `material`, `castShadow` and
`receiveShadow` fields of [MeshRenderer](#meshrenderer).
`TEXT_RENDERER_DEFAULTS` holds these defaults. An options object takes
either `asset` or `font`, never both.

- `align` places the text horizontally around the actor origin. The
  baseline sits on the origin and the depth is centered on it.
- Without a font, or with blank text, the mesh has an empty geometry.

### font: Font | null

Setting another font rebuilds the geometry.

### configure(options): this

Merges `options` into the current settings, field by field for `material`.
The geometry is rebuilt only when a shape field (`text` to `align`)
changes; the material is updated in place.

### TextDefinition

The scene file definition of type `"Text"`. Its data is the settings
above; its `font` asset slot takes a `font` asset.

## MeshRenderer

Renders a primitive geometry with a `MeshStandardMaterial`, or with the
material of a shader.

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

The constructor also takes `shader?: Shader | null` (`null` by default) and
`uniforms?: ShaderUniformValues` (`{}`). The renderer calls
`shader.createMaterial(uniforms)` once, renders with the returned material and
disposes it with the component. The `material` settings are still kept and
captured, but the shader material ignores them. `threeMesh.material` is typed
`THREE.Material` for that reason, and `shader` returns the shader or `null`.

`MeshGeometry` is a union over `kind` (`box`, `sphere`, `plane`, `cylinder`,
`cone`, `torus`, `capsule`). Its other fields are the size and segment
parameters of the matching three.js geometry constructor.
`MESH_GEOMETRY_DEFAULTS` maps each kind to a geometry with default
parameters.

### configure(options): this

Merges `options` into the current settings, field by field for `material`,
and writes them to the live mesh. A geometry with different parameters
replaces the current one, which is disposed; the material is updated in
place. A shader material is never replaced by `configure`.

### assignUniforms(values): this

Sets the given uniforms on the live shader material, without rebuilding it.
Uniforms missing from `values` keep their current value. Does nothing on a
mesh without a shader.

### MeshDefinition

The scene file definition of type `"Mesh"`. Its data is the settings above
plus `uniforms`, a JSON object of shader uniform values keyed by uniform name
(`MeshData`). Its `shader` asset slot takes a `shader` asset
(`ShaderAssetType`); while the slot is empty or unresolved, the mesh uses the
standard material.

- A number uniform reads a number, a color uniform a `#rrggbb` string, and a
  vector uniform an object of `x`, `y`, `z` and `w` numbers; a missing axis
  keeps the default. A value of the wrong type is ignored.
- A texture uniform reads the `texture` asset in the component slot
  `shaderTextureSlot(name)` (`"texture:<name>"`). These slots are not declared
  in `assets`; the scene still tracks them as dependencies.
- `apply` updates the number, color and vector uniforms of a shaded mesh in
  place; a missing or mistyped value goes back to the declared default.
- `capture` writes back the `uniforms` of the stored data, when it has some.

## See also

- [ActorComponent](../actor/actor-component.md)
- [Camera3DControls](camera-3d-controls.md)
- [Behavior](behavior.md)
- [Asset Loading](../asset.md)
