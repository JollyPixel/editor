# Registering from features

An editor grows its console one feature at a time: the brush, then layers, then templates. Each
feature declares what it registers as a `ConsoleFeature`, and the editor registers its list in one
call and tears it down with one handle.

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

A feature is a function that registers its namespace and returns it. A `ConsoleNamespace` is a
`RegistrationHandle`, so the namespace is the handle.

```ts
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";

export function brushConsole(
  commands: CommandConsole,
  { state }: Pick<VoxelMapWorkspace, "state">
): RegistrationHandle {
  const brush = commands.registerNamespace("brush", {
    description: "Voxel brush"
  });
  brush.registerVariable("size", {
    type: "number",
    description: "Brush size in voxels, from 1 to 16",
    get: () => state.brush.size,
    set: (size) => {
      state.brush.size = size;
    }
  });

  return brush;
}
```

Type the context as the slice the feature reads. `Pick<VoxelMapWorkspace, "state">` lets the
feature's spec pass `{ state }` alone, while the editor still passes its whole workspace: a
feature over a narrower context is assignable to a list over a wider one.

Give each feature its own namespace. Registering a namespace name again replaces the namespace
whole, so a second feature registering `brush` would drop the first one's variables.

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

Features register in list order. `unregister()` removes them in reverse order, and a second call
does nothing. When a feature throws while registering, the ones before it are unregistered and the
error is rethrown, so a failed boot leaves nothing behind.

A new feature is one module and one line in the list. The editor's boot code does not change.
