// Import Third-party Dependencies
import type {
  AssetLoader,
  AssetType
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import type {
  JSONObject,
  SceneComponentFile
} from "../scene/file/SceneFile.ts";
import {
  ComponentDefinitions,
  type AnyComponentDefinition
} from "../scene/file/definitions/ComponentDefinitions.ts";

export interface AssetLoaderDefinition<
  TLoadContext = unknown,
  TValue = unknown
> {
  readonly type: AssetType<TValue>;
  create(
    context: TLoadContext
  ): AssetLoader<TValue>;
}

export type PhysicsCheck = (
  data: Readonly<JSONObject>
) => boolean;

export interface ComponentPackage<TLoadContext = unknown> {
  readonly definitions: readonly AnyComponentDefinition[];
  readonly loaders?: readonly AssetLoaderDefinition<TLoadContext>[];
  readonly usesPhysics?: Readonly<Record<string, PhysicsCheck>>;
}

export type NamedComponentPackage<TLoadContext = unknown> = readonly [
  name: string,
  components: ComponentPackage<TLoadContext>
];

export interface ContributedComponents<TLoadContext = unknown> {
  readonly components: ComponentDefinitions;
  readonly loaders: readonly AssetLoaderDefinition<TLoadContext>[];

  usesPhysics(
    component: Readonly<SceneComponentFile>
  ): boolean;
}

export function contributedComponents<TLoadContext>(
  packages: Iterable<NamedComponentPackage<TLoadContext>>
): ContributedComponents<TLoadContext> {
  const components = new ComponentDefinitions();
  const loaders: AssetLoaderDefinition<TLoadContext>[] = [];
  const physicsChecks = new Map<string, PhysicsCheck>();
  const owners = new Map<string, string>();

  for (const [name, contributed] of packages) {
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
