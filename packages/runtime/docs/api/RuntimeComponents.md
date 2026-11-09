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
type RuntimeComponentWorld = Systems.World<any, any>;

interface RuntimeComponentPackage {
  readonly definitions: readonly Systems.AnyComponentDefinition[];
  readonly loaders?: readonly RuntimeAssetLoaderDefinition[];

  setup?(world: RuntimeComponentWorld): Promise<void> | void;
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

  setup(world: RuntimeComponentWorld): Promise<void>;
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
component type or the same asset kind.

### setup

`setup` prepares the world before the first scene loads, such as attaching
the physics world a component needs. `RuntimeComponents.setup()` awaits each
package's `setup` in turn, in package order.
