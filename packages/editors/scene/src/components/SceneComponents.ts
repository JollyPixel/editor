// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import type { SceneComponentView } from "@jolly-pixel/asset.scene/client";
import type { AssetDocumentKind } from "@jolly-pixel/editor.host";
import {
  registerKindIcon,
  requiredAssetSlots,
  type AssetSlots,
  type NamedSceneComponentPackage,
  type SceneAssetSource,
  type SceneComponentKind,
  type SceneComponentOrigin,
  type SceneComponentSummary
} from "@jolly-pixel/editor.host/scene";
import { Systems } from "@jolly-pixel/engine";

// CONSTANTS
export const EMPTY_ACTOR_ICON = "actor-empty";
const kNoSlots: KindSlots = {
  optional: new Set(),
  required: {},
  shown: {}
};

export type AssetChange = Record<string, AssetReferenceData | null>;

interface KindSlots {
  readonly optional: ReadonlySet<string>;
  readonly required: AssetSlots;
  readonly shown: AssetSlots;
}

export interface AssetNaming {
  name(
    reference: AssetReferenceData
  ): string;
}

export type DescribedComponent = Pick<
  SceneComponentView,
  "type" | "data" | "assets"
>;

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

  static #partition(
    kind: SceneComponentKind,
    sources: ReadonlyMap<string, SceneAssetSource>
  ): KindSlots {
    const optional = new Set<string>(kind.optionalAssets);
    const slots = Object.entries(kind.definition.assets ?? {});

    return {
      optional,
      required: requiredAssetSlots(kind),
      shown: Object.fromEntries(slots.filter(
        ([name, slot]) => !optional.has(name) || sources.has(slot.kind.value)
      ))
    };
  }

  static #icon(
    kind: SceneComponentKind,
    slots: KindSlots,
    assetIcons: ReadonlyMap<string, string | undefined>
  ): string {
    for (const slot of Object.values(slots.required)) {
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
  #slots: ReadonlyMap<string, KindSlots>;
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
    this.#slots = new Map(this.kinds.map(
      (kind) => [kind.definition.type, SceneComponents.#partition(kind, this.#assetSources)]
    ));
    this.#icons = new Map(this.kinds.map((kind) => [
      kind.definition.type,
      SceneComponents.#icon(kind, this.#findSlots(kind.definition.type), assetIcons)
    ]));
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

  summary(
    component: DescribedComponent,
    naming: AssetNaming
  ): SceneComponentSummary {
    const kind = this.find(component.type);
    if (kind === undefined) {
      return { label: component.type };
    }

    const names: Record<string, string> = {};
    for (const slot of Object.keys(kind.definition.assets ?? {})) {
      const reference = component.assets[slot];
      if (reference !== null && reference !== undefined) {
        names[slot] = naming.name(reference);
      }
    }
    if (kind.describe !== undefined) {
      return kind.describe(kind.definition.parse(component.data), names);
    }

    const detail = Object.keys(this.#findSlots(component.type).required)
      .map((slot) => names[slot])
      .find((name) => name !== undefined);

    return detail === undefined ?
      { label: kind.label } :
      {
        label: kind.label,
        detail
      };
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
  ): AssetSlots {
    return this.#findSlots(type).shown;
  }

  requiredAssetSlots(
    type: string
  ): AssetSlots {
    return this.#findSlots(type).required;
  }

  picksAssets(
    type: string
  ): boolean {
    return Object.keys(this.requiredAssetSlots(type)).length > 0;
  }

  assetChange(
    component: Pick<DescribedComponent, "type" | "assets">,
    slot: string,
    reference: AssetReferenceData | null
  ): AssetChange {
    const change: AssetChange = { [slot]: reference };
    if (!this.#findSlots(component.type).optional.has(slot)) {
      return change;
    }

    const declared = this.find(component.type)?.definition.assets ?? {};
    for (const [other, current] of Object.entries(component.assets)) {
      if (!Object.hasOwn(declared, other) && current !== null) {
        change[other] = null;
      }
    }

    return change;
  }

  createDefinitions(): Systems.ComponentDefinitions {
    return new Systems.ComponentDefinitions().register(
      ...this.kinds.map((kind) => kind.definition)
    );
  }

  #findSlots(
    type: string
  ): KindSlots {
    return this.#slots.get(type) ?? kNoSlots;
  }
}
