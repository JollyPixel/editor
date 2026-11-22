# Assets

The asset types and loaders of the three.js backend. Scenes declare
references to them and components read them with `resolveAsset()`, as in
any `@jolly-pixel/ecs` world.

## Using a reference in a component

Built-in model and text renderers accept typed references instead of paths:

```ts
import { AssetReference } from "@jolly-pixel/asset";
import { ModelAssetType, ModelRenderer } from "@jolly-pixel/backend.three";

const knight = new AssetReference("model.knight", ModelAssetType);

actor.addComponent(ModelRenderer, {
  asset: knight
});
```

## Built-in types and loaders

| Type | Kind | Loader | Supported formats |
| ---- | ---- | ------ | ----------------- |
| `ModelAssetType` | `model` | `ModelAssetLoader` | OBJ, FBX, glTF, GLB (including `EXT_meshopt_compression`) |
| `FontAssetType` | `font` | `FontAssetLoader` | Three.js typeface JSON |
| `SoundAssetType` | `sound` | `SoundAssetLoader` | Formats `decodeAudioData` supports, with [sound settings](./audio/audio.md#sound) read from an Ogg header |
| `TEXTURE_ASSET` | `texture` | `TextureAssetLoader` | Formats supported by `THREE.TextureLoader`, plus KTX2 (see below) |
| `SceneFileAssetType` | `scene` | `JSONFileAssetLoader` | A `SceneFile` as JSON, read by `FileScene` |
| `Systems.ENVIRONMENT_ASSET` | `environment` | `JSONFileAssetLoader` | An `EnvironmentFile` as JSON |

`Systems.ENVIRONMENT_ASSET` comes from `@jolly-pixel/ecs`.

`createDefaultAssetLoaders(manager, options?)` returns an `AssetLoaderRegistry`
holding these loaders, sharing one Three.js `LoadingManager`. The model loader
imports a format's three.js loader on the first file of that format.

```ts
const loaders = createDefaultAssetLoaders(new THREE.LoadingManager());
const coordinator = new AssetCoordinator({
  catalog,
  loaders
});
```

`options.loaders` registers more loaders after the built-in ones, each built
with the same manager. A definition for a kind the built-in loaders already
handle throws `AssetLoaderAlreadyExistsError`.

```ts
const loaders = createDefaultAssetLoaders(manager, {
  loaders: [
    {
      type: TILE_MAP_ASSET,
      create: (manager) => new TileMapAssetLoader(manager)
    }
  ]
});
```

### Models from bytes

`parseModel(content, fileName, options?)` reads a model already in memory,
picking the format from `fileName`'s extension. The model loader uses it
after fetching a file.

```ts
const model = await parseModel(bytes, "knight.glb", {
  resourcePath: "models/",
  manager
});
```

- `resourcePath` (default `""`) is the folder external files resolve against: textures, `.bin` buffers and `.mtl` libraries. They load through `manager`, so its URL modifier can map them.
- An `.obj` file loads each `.mtl` library its `mtllib` lines name. A library that fails to load is skipped, and the faces it would color keep OBJLoader's default material.
- `texture` names an image, relative to `resourcePath`, that an `.obj` file with no `usemtl` line takes as the map of its default materials (sRGB, nearest magnification). An `.obj` file that uses a material, and the other formats, ignore it.
- An unknown extension rejects with `Unsupported model type`.

`modelTextureNames(fileName)` lists the image names an `.obj` file looks for
beside it, in lookup order: its own name with `.png`, `.jpg`, `.jpeg`, then
`.webp`. Other formats get an empty list. The model loader passes the first
one its catalog holds in the model's folder as `texture`, so `Sphere.obj`
next to `Sphere.png` loads textured.

### KTX2 textures

`TextureAssetLoader` sends `.ktx2` paths to the `ktx2` option, any object
with `loadAsync(url): Promise<THREE.CompressedTexture>` (a
`CompressedTextureLoader`). Without it, loading a `.ktx2` path rejects. The
same `filter` and `colorSpace` apply to both paths. `filter` is the
magnification filter; a texture with mipmaps (any image, or a KTX2 file with
mip levels) minifies trilinearly, and one without uses `filter`.

```ts
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const ktx2 = new KTX2Loader(manager)
  .setTranscoderPath("/basis/")
  .detectSupport(renderer);
const loaders = createDefaultAssetLoaders(manager, { ktx2 });
```

The transcoder path serves `basis_transcoder.js` and `basis_transcoder.wasm`
from `three/examples/jsm/libs/basis/`. `detectSupport()` needs an initialized
renderer. The caller disposes the loader; [`Runtime`](./runtime/runtime-assets.md)
does it for its `assets.ktx2` option.

### Shaders

`ShaderAssetType` (kind `shader`) types a `Shader`:

```ts
type ShaderUniformValue =
  number | THREE.Color | THREE.Vector2 | THREE.Vector3 | THREE.Vector4 | THREE.Texture;

interface Shader {
  readonly uniforms: Readonly<Record<string, ShaderUniformValue>>; // declared defaults
  createMaterial(values?: Readonly<Record<string, ShaderUniformValue>>): ShadedMaterial;
}

interface ShadedMaterial {
  readonly material: THREE.Material;
  readonly animated: boolean;
  assign(values: Readonly<Record<string, ShaderUniformValue>>): void;
}
```

`animated` is true when the material changes every frame, such as one that
reads `time`. `MeshRenderer` and `ModelRenderer` keep the world rendering
while they hold an animated material.

`createMaterial` builds a new material on each call; a uniform missing from
`values` keeps its default. `assign` changes the uniforms it is given on that
live material and leaves the others as they are. Each value must have the
kind of the declared default. The backend has no loader for shaders: the
editor that owns the kind resolves them.

The uniform helpers work on any of those values:

- `isShaderUniformValue(value)` tells whether `value` is one of them.
- `describeShaderUniform(value)` returns `{ kind: "texture" }`, or the `kind`
  (`"number"`, `"color"`, `"vector2"`, `"vector3"` or `"vector4"`) with
  `json`, the value as a `MeshDefinition` reads it from its `uniforms` data: a
  number as is, a color as `#rrggbb` and a vector as an object of `x`, `y`,
  `z` and `w` numbers.
- `shaderTextureSlot(name)` is the component asset slot of a texture uniform,
  `"texture:<name>"`.
