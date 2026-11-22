# disposeObject3D

Disposes the GPU resources of an `Object3D` subtree, each one once even when
several nodes share it. Three.js never frees them on its own.

```ts
import { disposeObject3D } from "@jolly-pixel/backend.three";

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
| `stopAt` | none | Leaves out each descendant it returns true for, with its subtree. |

### textures

Textures are often shared between materials, so disposing them is opt-in:

```ts
disposeObject3D(mesh, { textures: true });
```

Only pass `true` when the subtree owns its textures. It covers material
texture properties (`map`, `normalMap`, ...) and `ShaderMaterial` uniforms,
and closes `ImageBitmap` sources.

### stopAt

The root is always traversed. Use it to keep a subtree that another owner
disposes; destroying an actor skips nested actors this way.

```ts
disposeObject3D(root, {
  stopAt: (object) => object === sharedRig
});
```

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
