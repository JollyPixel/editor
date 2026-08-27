# disposeObject3D

Releases the GPU resources owned by an `Object3D` subtree.

Three.js never frees geometries, materials or textures on its own: they
live until `dispose()` is called on them. `disposeObject3D` walks a
subtree, collects every disposable resource it finds and disposes each
one exactly once, even when several nodes share it.

```ts
import { disposeObject3D } from "@jolly-pixel/engine";

scene.remove(mesh);
disposeObject3D(mesh);
```

## Signature

```ts
function disposeObject3D(
  root: THREE.Object3D,
  options?: DisposeObject3DOptions
): void;
```

The root node is part of the traversal. Once the walk is done, the root
is detached from its parent and its children are removed.

## Options

| Option | Default | Description |
|---|---|---|
| `textures` | `false` | Dispose the textures reachable from the traversed materials. |
| `detach` | `true` | Detach the root from its parent before disposing it. |
| `stopAtActors` | `false` | Stop the traversal on nested actor `object3D`. |

### textures

Disposing a material has no effect on its textures, because a single
texture is commonly shared by several materials (a tileset atlas, an
asset library entry). Texture disposal is therefore opt-in:

```ts
disposeObject3D(mesh, { textures: true });
```

Only pass `true` when the subtree owns its textures. When enabled, the
walk covers the material's own texture properties (`map`, `normalMap`,
`emissiveMap`, ...) and the texture values held by `ShaderMaterial`
uniforms. A texture backed by an `ImageBitmap` also gets its source
closed, since Three.js leaves that call to the application.

### stopAtActors

Actors mark their group with `userData.isActor`. With `stopAtActors`,
the traversal does not descend into a nested actor, which owns its own
destruction. [Actor](../actor/actor.md) uses this on `destroy()`.

## What gets disposed

- `BufferGeometry` on any node exposing a `geometry`.
- `Material`, single or array.
- `Texture`, when `textures` is enabled.
- `Skeleton` on skinned meshes, once per skeleton even when shared.
- `renderTarget`, on nodes owning one (`CubeCamera`).
- Any node exposing its own `dispose()` method (`InstancedMesh`,
  `BatchedMesh`, ...).

Textures held inside node material graphs (TSL) are not reachable
through plain material properties and are left untouched.
