# Registering from features

An editor registers its console entries feature by feature. Each feature is a function that
registers a namespace and returns it.

```ts
type ConsoleFeature<TContext> = (
  commands: CommandConsole,
  context: TContext
) => RegistrationHandle;

function registerConsoleFeatures<TContext>(
  commands: CommandConsole,
  features: Iterable<ConsoleFeature<TContext>>,
  context: TContext
): RegistrationHandle;
```

## Declaring a feature

```ts
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";

export function brushConsole(
  commands: CommandConsole,
  { brush }: Pick<VoxelMapWorkspace, "brush">
): RegistrationHandle {
  const namespace = commands.registerNamespace("brush", {
    description: "Voxel brush"
  });
  namespace.registerVariable("size", {
    type: "number",
    description: "Brush size in voxels, from 1 to 16",
    get: () => brush.size,
    set: (size) => {
      brush.size = size;
    }
  });

  return namespace;
}
```

- Type the context as only what the feature uses (`Pick<...>`), so tests can pass just that.
- Give each feature its own namespace: registering the same name twice replaces the first one.
- A package embedded in several editors nests its namespaces under its own name, such as
  `pixelart.keybinds`, so they never collide with the host editor's. Features can share the
  parent: `pixelart` exists while any `pixelart.*` namespace is registered.

## Registering the list

```ts
import { registerConsoleFeatures } from "@jolly-pixel/console";

export const CONSOLE_FEATURES: readonly ConsoleFeature<VoxelMapWorkspace>[] = [
  brushConsole
];

const features = registerConsoleFeatures(
  context.commands,
  CONSOLE_FEATURES,
  workspace
);

// on dispose
features.unregister();
```

Features register in order and unregister in reverse. If one throws, the ones already registered
are removed and the error is rethrown.
