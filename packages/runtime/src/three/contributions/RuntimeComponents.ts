// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type {
  RuntimeAssetLoaderDefinition
} from "../assets/RuntimeAssetOptions.ts";

export type RuntimeComponentWorld = Systems.World<any, any>;

export interface RuntimeComponentPackage {
  readonly definitions: readonly Systems.AnyComponentDefinition[];
  readonly loaders?: readonly RuntimeAssetLoaderDefinition[];

  setup?(
    world: RuntimeComponentWorld
  ): Promise<void> | void;
}

export interface RuntimeContribution {
  readonly name: string;
  readonly module: {
    readonly RUNTIME_COMPONENTS?: RuntimeComponentPackage;
  };
}

export interface RuntimeComponents {
  readonly components: Systems.ComponentDefinitions;
  readonly loaders: readonly RuntimeAssetLoaderDefinition[];

  setup(
    world: RuntimeComponentWorld
  ): Promise<void>;
}

export function contributedRuntimeComponents(
  contributions: Iterable<RuntimeContribution>
): RuntimeComponents {
  const components = new Systems.ComponentDefinitions();
  const loaders: RuntimeAssetLoaderDefinition[] = [];
  const packages: RuntimeComponentPackage[] = [];
  const owners = new Map<string, string>();

  for (const { name, module } of contributions) {
    const contributed = module.RUNTIME_COMPONENTS;
    if (contributed === undefined) {
      throw new TypeError(
        `"${name}" declares "jollypixel.runtime" but does not export "RUNTIME_COMPONENTS".`
      );
    }

    for (const definition of contributed.definitions) {
      claim(owners, `Component type "${definition.type}"`, name);
      components.register(definition);
    }
    for (const loader of contributed.loaders ?? []) {
      claim(owners, `Asset kind "${loader.type.kind.value}"`, name);
      loaders.push(loader);
    }
    packages.push(contributed);
  }

  return {
    components,
    loaders,
    async setup(world) {
      for (const contributed of packages) {
        await contributed.setup?.(world);
      }
    }
  };
}

function claim(
  owners: Map<string, string>,
  subject: string,
  owner: string
): void {
  const previous = owners.get(subject);
  if (previous !== undefined) {
    throw new TypeError(
      `${subject} is declared by both "${previous}" and "${owner}".`
    );
  }
  owners.set(subject, owner);
}
