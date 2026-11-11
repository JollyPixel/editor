# Runtime components

A package that adds scene component types gives a game their engine
definitions and the loaders of the assets they read. The package names an
export subpath in the `jollypixel.runtime` field of its `package.json`, and
that subpath exports `RUNTIME_COMPONENTS`:

```json
{
  "jollypixel": {
    "runtime": "./runtime"
  },
  "exports": {
    "./runtime": "./src/runtime/index.ts"
  }
}
```

```ts
import type { RuntimeComponentPackage } from "@jolly-pixel/runtime";
import { VoxelMapDefinition } from "@jolly-pixel/voxel.renderer/engine";

export const RUNTIME_COMPONENTS: RuntimeComponentPackage = {
  definitions: [new VoxelMapDefinition()]
};
```

The runtime entry holds game code only: no editor forms, no asset rooms. An
editor that shows the same component types reuses these definition objects.

## API

```ts
type RuntimePhysicsCheck = (data: Readonly<Systems.JSONObject>) => boolean;

interface RuntimeComponentPackage {
  readonly definitions: readonly Systems.AnyComponentDefinition[];
  readonly loaders?: readonly RuntimeAssetLoaderDefinition[];
  readonly usesPhysics?: Readonly<Record<string, RuntimePhysicsCheck>>;
}

interface RuntimeContribution {
  readonly name: string;
  readonly module: {
    readonly RUNTIME_COMPONENTS?: RuntimeComponentPackage;
  };
}

interface RuntimeComponents {
  readonly components: Systems.ComponentDefinitions;
  readonly loaders: readonly RuntimeAssetLoaderDefinition[];

  usesPhysics(component: Readonly<Systems.SceneComponentFile>): boolean;
}

function contributedRuntimeComponents(
  contributions: Iterable<RuntimeContribution>
): RuntimeComponents;
```

A loader produces the value the component's asset slot expects, from the
asset's built content. `RuntimeAssetLoaderDefinition` is described in
[runtime asset options](./runtime-assets.md#loaders).

### contributedRuntimeComponents

Registers every package's definitions in one new `ComponentDefinitions` and
lists their loaders in package order. Pass `components` to a `FileScene` and
`loaders` to `Runtime.create({ assets: { loaders } })`.

It throws a `TypeError` naming the package when a module does not export
`RUNTIME_COMPONENTS`, and naming both packages when two declare the same
component type or the same asset kind. It also throws a `TypeError` when a
package checks physics for a component type it does not declare.

### usesPhysics

A package whose components need a physics world gives a check per component
type. The check reads the component's scene data, before any component is
created:

```ts
export const RUNTIME_COMPONENTS: RuntimeComponentPackage = {
  definitions: [RIGID_BODY_DEFINITION, VOXEL_MAP_DEFINITION],
  usesPhysics: {
    [RIGID_BODY_DEFINITION.type]: () => true,
    [VOXEL_MAP_DEFINITION.type]: (data) => data.collision === true
  }
};
```

`RuntimeComponents.usesPhysics()` runs the check of the component's type, and
is `false` for a type without one. The game attaches the physics world before
the first scene loads, and only when a component of that scene or of a prefab
it expands uses physics; the package never picks a physics engine itself. A
body created any other way, such as from a script, finds no physics world in
a scene that does not use physics.
