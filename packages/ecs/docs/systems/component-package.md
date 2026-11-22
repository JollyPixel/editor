# Component packages

A package that adds scene component types gives a game their component
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
import type { Systems } from "@jolly-pixel/ecs";
import { VoxelMapDefinition } from "@jolly-pixel/voxel.renderer/engine";

export const RUNTIME_COMPONENTS: Systems.ComponentPackage = {
  definitions: [new VoxelMapDefinition()]
};
```

The runtime entry holds game code only: no editor forms, no asset rooms. An
editor that shows the same component types reuses these definition objects.

## API

```ts
interface AssetLoaderDefinition<TLoadContext = unknown, TValue = unknown> {
  readonly type: AssetType<TValue>;

  create(context: TLoadContext): AssetLoader<TValue>;
}

type PhysicsCheck = (data: Readonly<JSONObject>) => boolean;

interface ComponentPackage<TLoadContext = unknown> {
  readonly definitions: readonly AnyComponentDefinition[];
  readonly loaders?: readonly AssetLoaderDefinition<TLoadContext>[];
  readonly usesPhysics?: Readonly<Record<string, PhysicsCheck>>;
}

type NamedComponentPackage<TLoadContext = unknown> = readonly [
  name: string,
  components: ComponentPackage<TLoadContext>
];

interface ContributedComponents<TLoadContext = unknown> {
  readonly components: ComponentDefinitions;
  readonly loaders: readonly AssetLoaderDefinition<TLoadContext>[];

  usesPhysics(component: Readonly<SceneComponentFile>): boolean;
}

function contributedComponents<TLoadContext>(
  packages: Iterable<NamedComponentPackage<TLoadContext>>
): ContributedComponents<TLoadContext>;
```

All of them are members of `Systems`.

A loader produces the value the component's asset slot expects, from the
asset's built content. `TLoadContext` is what the backend hands each loader's
`create()`: the three.js runtime passes its `LoadingManager` and names the
result `ThreeComponentPackage`.

### contributedComponents

Takes each package's `RUNTIME_COMPONENTS` paired with the package name.
Registers every package's definitions in one new `ComponentDefinitions` and
lists their loaders in package order. Pass `components` to a `FileScene` and
`loaders` to the runtime that builds the asset coordinator.

It throws a `TypeError` naming both packages when two declare the same
component type or the same asset kind, and a `TypeError` when a package checks
physics for a component type it does not declare.

### usesPhysics

A package whose components need a physics world gives a check per component
type. The check reads the component's scene data, before any component is
created:

```ts
export const RUNTIME_COMPONENTS: Systems.ComponentPackage = {
  definitions: [RIGID_BODY_DEFINITION, VOXEL_MAP_DEFINITION],
  usesPhysics: {
    [RIGID_BODY_DEFINITION.type]: () => true,
    [VOXEL_MAP_DEFINITION.type]: (data) => data.collision === true
  }
};
```

`ContributedComponents.usesPhysics()` runs the check of the component's type,
and is `false` for a type without one. The game attaches the physics world
before the first scene loads, and only when a component of that scene or of a
prefab it expands uses physics; the package never picks a physics engine
itself. A body created any other way, such as from a script, finds no physics
world in a scene that does not use physics.
