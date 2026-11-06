// Import Third-party Dependencies
import type { AssetType } from "@jolly-pixel/asset";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import type { AssetDocumentKind } from "@jolly-pixel/editor.host";
import {
  registerKindIcon,
  type SceneAssetSource,
  type SceneComponentKind,
  type SceneComponentOrigin,
  type SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import { Systems } from "@jolly-pixel/engine";

// CONSTANTS
export const EMPTY_ACTOR_ICON = "actor-empty";

export type NamedSceneComponentPackage = readonly [
  name: string,
  components: SceneComponentPackage
];

export class SceneComponents {
  static #claim(
    owners: Map<string, string>,
    key: string,
    owner: string,
    subject: string
  ): void {
    const previous = owners.get(key);
    if (previous !== undefined) {
      throw new TypeError(
        `${subject} "${key}" is declared by both "${previous}" and "${owner}".`
      );
    }
    owners.set(key, owner);
  }

  static #icon(
    kind: SceneComponentKind,
    assetIcons: ReadonlyMap<string, string | undefined>
  ): string {
    for (const slot of Object.values(kind.definition.assets ?? {})) {
      const icon = assetIcons.get(slot.kind.value);
      if (icon !== undefined) {
        return icon;
      }
    }

    return kind.icon ?? EMPTY_ACTOR_ICON;
  }

  readonly kinds: readonly SceneComponentKind[];

  #kinds = new Map<string, SceneComponentKind>();
  #assetSources = new Map<string, SceneAssetSource>();
  #icons: ReadonlyMap<string, string>;

  constructor(
    packages: Iterable<NamedSceneComponentPackage>
  ) {
    const typeOwners = new Map<string, string>();
    const assetOwners = new Map<string, string>();
    for (const [name, { components, assets = [] }] of packages) {
      for (const kind of components) {
        SceneComponents.#claim(typeOwners, kind.definition.type, name, "Component type");
        this.#kinds.set(kind.definition.type, kind);
      }
      for (const source of assets) {
        SceneComponents.#claim(assetOwners, source.descriptor.kind, name, "Asset kind");
        this.#assetSources.set(source.descriptor.kind, source);
      }
    }

    const assetIcons = new Map(Array.from(
      this.#assetSources,
      ([kind, { descriptor }]) => [kind, registerKindIcon(descriptor)]
    ));
    this.kinds = [...this.#kinds.values()];
    this.#icons = new Map(this.kinds.map(
      (kind) => [kind.definition.type, SceneComponents.#icon(kind, assetIcons)]
    ));
  }

  get descriptors(): AssetKindDescriptor[] {
    return Array.from(
      this.#assetSources.values(),
      ({ descriptor }) => descriptor
    );
  }

  get documentKinds(): AssetDocumentKind<unknown>[] {
    return [...this.#assetSources.values()].flatMap(
      ({ documentKinds }) => documentKinds
    );
  }

  find(
    type: string
  ): SceneComponentKind | undefined {
    return this.#kinds.get(type);
  }

  assetSource(
    kind: string
  ): SceneAssetSource | undefined {
    return this.#assetSources.get(kind);
  }

  icon(
    type: string
  ): string {
    return this.#icons.get(type) ?? EMPTY_ACTOR_ICON;
  }

  label(
    type: string
  ): string {
    return this.find(type)?.label ?? type;
  }

  actorOrigin(
    types: Iterable<string>
  ): SceneComponentOrigin {
    for (const type of types) {
      if (this.find(type)?.origin === "corner") {
        return "corner";
      }
    }

    return "center";
  }

  assetSlots(
    type: string
  ): Readonly<Record<string, AssetType<unknown>>> {
    return this.find(type)?.definition.assets ?? {};
  }

  picksAssets(
    type: string
  ): boolean {
    return Object.keys(this.assetSlots(type)).length > 0;
  }

  createDefinitions(): Systems.ComponentDefinitions {
    return new Systems.ComponentDefinitions().register(
      ...this.kinds.map((kind) => kind.definition)
    );
  }
}
