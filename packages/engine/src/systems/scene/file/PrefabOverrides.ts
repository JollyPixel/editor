// Import Internal Dependencies
import { InstancePath } from "./InstancePath.ts";
import type {
  SceneActorFile,
  SceneActorOverrideFile,
  SceneComponentFile,
  SceneComponentOverrideFile,
  SceneOverridesFile
} from "./SceneFile.ts";

type OverrideRecord<TEntry> = Readonly<Record<string, Readonly<TEntry>>>;

export class PrefabOverrides {
  static readonly NONE = new PrefabOverrides({});

  static from(
    file: Readonly<SceneOverridesFile> | undefined
  ): PrefabOverrides {
    return file === undefined ? PrefabOverrides.NONE : new PrefabOverrides(file);
  }

  readonly #actors: OverrideRecord<SceneActorOverrideFile>;
  readonly #components: OverrideRecord<SceneComponentOverrideFile>;

  constructor(
    file: Readonly<SceneOverridesFile>
  ) {
    this.#actors = file.actors ?? {};
    this.#components = file.components ?? {};
  }

  actor(
    path: string
  ): Readonly<SceneActorOverrideFile> | undefined {
    return Object.hasOwn(this.#actors, path) ? this.#actors[path] : undefined;
  }

  component(
    path: string
  ): Readonly<SceneComponentOverrideFile> | undefined {
    return Object.hasOwn(this.#components, path) ? this.#components[path] : undefined;
  }

  scope(
    file: Readonly<SceneActorFile>,
    instanceId: string
  ): SceneActorFile {
    const {
      overrides: _overrides,
      anchor,
      ...rest
    } = file;
    const actor = this.actor(file.id) ?? {};
    const nested = file.prefab === undefined ?
      undefined :
      this.handedDown(file.id).over(PrefabOverrides.from(file.overrides)).toFile();

    return {
      ...rest,
      id: InstancePath.join(instanceId, file.id),
      parentId: file.parentId === null ?
        instanceId :
        InstancePath.join(instanceId, file.parentId),
      name: actor.name ?? file.name,
      visible: actor.visible ?? file.visible,
      transform: {
        ...file.transform,
        ...actor.transform
      },
      components: file.components.map(
        (component) => this.#scopeComponent(component, instanceId)
      ),
      ...anchor === undefined ? {} : {
        anchor: {
          component: InstancePath.join(instanceId, anchor.component),
          key: anchor.key
        }
      },
      ...nested === undefined ? {} : { overrides: nested }
    };
  }

  handedDown(
    nestedId: string
  ): PrefabOverrides {
    return new PrefabOverrides({
      actors: below(this.#actors, nestedId),
      components: below(this.#components, nestedId)
    });
  }

  over(
    inner: PrefabOverrides
  ): PrefabOverrides {
    const actors: Record<string, SceneActorOverrideFile> = { ...inner.#actors };
    for (const [path, outer] of Object.entries(this.#actors)) {
      const base = inner.actor(path) ?? {};
      actors[path] = {
        ...base,
        ...outer,
        ...base.transform === undefined || outer.transform === undefined ? {} : {
          transform: {
            ...base.transform,
            ...outer.transform
          }
        }
      };
    }

    const components: Record<string, SceneComponentOverrideFile> = { ...inner.#components };
    for (const [path, outer] of Object.entries(this.#components)) {
      const base = inner.component(path) ?? {};
      components[path] = {
        ...base,
        ...outer,
        ...base.data === undefined || outer.data === undefined ? {} : {
          data: {
            ...base.data,
            ...outer.data
          }
        },
        ...base.assets === undefined || outer.assets === undefined ? {} : {
          assets: {
            ...base.assets,
            ...outer.assets
          }
        }
      };
    }

    return new PrefabOverrides({
      actors,
      components
    });
  }

  toFile(): SceneOverridesFile | undefined {
    const hasActors = Object.keys(this.#actors).length > 0;
    const hasComponents = Object.keys(this.#components).length > 0;
    if (!hasActors && !hasComponents) {
      return undefined;
    }

    return {
      ...hasActors ? { actors: { ...this.#actors } } : {},
      ...hasComponents ? { components: { ...this.#components } } : {}
    };
  }

  #scopeComponent(
    component: Readonly<SceneComponentFile>,
    instanceId: string
  ): SceneComponentFile {
    const override = this.component(component.id) ?? {};

    return {
      ...component,
      id: InstancePath.join(instanceId, component.id),
      data: {
        ...component.data,
        ...override.data
      },
      assets: {
        ...component.assets,
        ...override.assets
      }
    };
  }
}

function below<TEntry>(
  record: OverrideRecord<TEntry>,
  nestedId: string
): Record<string, Readonly<TEntry>> {
  return Object.fromEntries(
    Object.entries(record).flatMap(([path, entry]) => {
      const nested = InstancePath.parse(path);

      return nested?.instanceId === nestedId ? [[nested.path, entry] as const] : [];
    })
  );
}
