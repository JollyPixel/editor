// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type {
  RuntimeAssetLoaderDefinition
} from "../assets/RuntimeAssetOptions.ts";

export type RuntimePhysicsCheck = (
  data: Readonly<Systems.JSONObject>
) => boolean;

export interface RuntimeComponentPackage {
  readonly definitions: readonly Systems.AnyComponentDefinition[];
  readonly loaders?: readonly RuntimeAssetLoaderDefinition[];
  readonly usesPhysics?: Readonly<Record<string, RuntimePhysicsCheck>>;
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

  usesPhysics(
    component: Readonly<Systems.SceneComponentFile>
  ): boolean;
}

export function contributedRuntimeComponents(
  contributions: Iterable<RuntimeContribution>
): RuntimeComponents {
  const components = new Systems.ComponentDefinitions();
  const loaders: RuntimeAssetLoaderDefinition[] = [];
  const physicsChecks = new Map<string, RuntimePhysicsCheck>();
  const owners = new Map<string, string>();

  for (const { name, module } of contributions) {
    const contributed = module.RUNTIME_COMPONENTS;
    if (contributed === undefined) {
      throw new TypeError(
        `"${name}" declares "jollypixel.runtime" but does not export "RUNTIME_COMPONENTS".`
      );
    }

    for (const definition of contributed.definitions) {
      claim(owners, componentType(definition.type), name);
      components.register(definition);
    }
    for (const loader of contributed.loaders ?? []) {
      claim(owners, `Asset kind "${loader.type.kind.value}"`, name);
      loaders.push(loader);
    }
    for (const [type, check] of Object.entries(contributed.usesPhysics ?? {})) {
      if (owners.get(componentType(type)) !== name) {
        throw new TypeError(
          `"${name}" checks physics for component type "${type}", which it does not declare.`
        );
      }
      physicsChecks.set(type, check);
    }
  }

  return {
    components,
    loaders,
    usesPhysics: (component) => (
      physicsChecks.get(component.type)?.(component.data) ?? false
    )
  };
}

function componentType(
  type: string
): string {
  return `Component type "${type}"`;
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
