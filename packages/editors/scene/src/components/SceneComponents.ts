// Import Third-party Dependencies
import type { AssetType } from "@jolly-pixel/asset";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import type { AssetDocumentKind } from "@jolly-pixel/editor.host";
import type {
  SceneActorPresetEntry,
  SceneAssetSource,
  SceneComponentKind,
  SceneComponentOrigin,
  SceneComponentPackage
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

  readonly kinds: readonly SceneComponentKind[];
  readonly presetSections: readonly (readonly SceneActorPresetEntry[])[];

  #kinds = new Map<string, SceneComponentKind>();
  #assetSources = new Map<string, SceneAssetSource>();

  constructor(
    packages: Iterable<NamedSceneComponentPackage>
  ) {
    const typeOwners = new Map<string, string>();
    const assetOwners = new Map<string, string>();
    const presetOwners = new Map<string, string>();
    const presetSections: (readonly SceneActorPresetEntry[])[] = [];
    for (const [name, { components, presets = [], assets = [] }] of packages) {
      for (const kind of components) {
        SceneComponents.#claim(typeOwners, kind.definition.type, name, "Component type");
        this.#kinds.set(kind.definition.type, kind);
      }
      for (const source of assets) {
        SceneComponents.#claim(assetOwners, source.descriptor.kind, name, "Asset kind");
        this.#assetSources.set(source.descriptor.kind, source);
      }
      for (const entry of presets) {
        for (const { id } of "presets" in entry ? entry.presets : [entry]) {
          SceneComponents.#claim(presetOwners, id, name, "Actor preset");
        }
      }
      if (presets.length > 0) {
        presetSections.push(presets);
      }
    }

    this.kinds = [...this.#kinds.values()];
    this.presetSections = presetSections;
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
    return this.find(type)?.icon ?? EMPTY_ACTOR_ICON;
  }

  actorIcon(
    types: Iterable<string>
  ): string {
    for (const type of types) {
      const icon = this.icon(type);
      if (icon !== EMPTY_ACTOR_ICON) {
        return icon;
      }
    }

    return EMPTY_ACTOR_ICON;
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
