# Assets in the engine

Scenes declare the assets they need, `SceneManager` loads them through the
world's `AssetCoordinator` before the scene starts, and components read them
synchronously.

## Declaring scene assets

Create references from stable IDs and the engine asset types, then pass them to
the scene constructor:

```ts
import {
  AssetReference,
  type AssetReferenceGroup
} from "@jolly-pixel/asset";
import {
  ActorComponent,
  AssetTypes,
  Systems
} from "@jolly-pixel/engine";

class KnightBehavior extends ActorComponent {
  static readonly assets = {
    model: new AssetReference(
      "model.knight",
      AssetTypes.model
    )
  } satisfies AssetReferenceGroup;

  override awake(): void {
    const model = this.resolveAsset(KnightBehavior.assets.model);
    // Use the prepared model synchronously.
  }
}

class BattleScene extends Systems.Scene {
  constructor() {
    super("battle", {
      assets: [KnightBehavior.assets]
    });
  }
}
```

`SceneOptions.assets` accepts references and reference groups, flattened
into the scene's `assets`. [SceneManager](systems/scene-manager.md) loads
them before activating the scene.

## Using a reference in a component

Built-in model and text renderers accept typed references instead of paths:

```ts
actor.addComponent(ModelRenderer, {
  asset: KnightBehavior.assets.model
});
```

`ActorComponent.resolveAsset(reference)` reads the loaded value synchronously.
A value not loaded yet throws `AssetNotReadyError`; it never starts a load.

## Built-in types and loaders

| Type | Kind | Loader | Supported formats |
| ---- | ---- | ------ | ----------------- |
| `AssetTypes.model` | `model` | `AssetLoaders.model` | OBJ, FBX, glTF, GLB (including `EXT_meshopt_compression`) |
| `AssetTypes.font` | `font` | `AssetLoaders.font` | Three.js typeface JSON |
| `AUDIO_ASSET` | `audio` | `AudioAssetLoader` | Formats supported by `THREE.AudioLoader` |
| `TEXTURE_ASSET` | `texture` | `TextureAssetLoader` | Formats supported by `THREE.TextureLoader`, plus KTX2 (see below) |
| `SceneFileAssetType` | `scene` | `SceneFileAssetLoader` | A `SceneFile` as JSON, read by [`FileScene`](./systems/scene-file.md) |

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

- `resourcePath` (default `""`) is the folder external textures and buffers resolve against.
- An `.obj` file read this way has no `.mtl` materials.
- An unknown extension rejects with `Unsupported model type`.

### KTX2 textures

`TextureAssetLoader` sends `.ktx2` paths to the `ktx2` option, any object
with `loadAsync(url): Promise<THREE.CompressedTexture>` (a
`CompressedTextureLoader`). Without it, loading a `.ktx2` path rejects. The
same `filter` and `colorSpace` apply to both paths.

```ts
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

const ktx2 = new KTX2Loader(manager)
  .setTranscoderPath("/basis/")
  .detectSupport(renderer);
const loaders = createDefaultAssetLoaders(manager, { ktx2 });
```

The transcoder path serves `basis_transcoder.js` and `basis_transcoder.wasm`
from `three/examples/jsm/libs/basis/`. `detectSupport()` needs an initialized
renderer. The caller disposes the loader; `@jolly-pixel/runtime` does it for
its `assets.ktx2` option.

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
  assign(values: Readonly<Record<string, ShaderUniformValue>>): void;
}
```

`createMaterial` builds a new material on each call; a uniform missing from
`values` keeps its default. `assign` changes the uniforms it is given on that
live material and leaves the others as they are. Each value must have the
kind of the declared default. The engine has no loader for shaders: the
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

Catalogs, references and handles come from `@jolly-pixel/asset`.
