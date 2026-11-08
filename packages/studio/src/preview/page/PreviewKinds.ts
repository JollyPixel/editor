// Import Third-party Dependencies
import {
  contributedScenePackages,
  requiredAssetSlots,
  type SceneAssetSource,
  type SceneComponentKind,
  type SceneContribution
} from "@jolly-pixel/editor.host/scene";

export interface PreviewKind {
  readonly source: SceneAssetSource;
  readonly component: SceneComponentKind;
  readonly slot: string;
}

export class PreviewKinds {
  readonly #kinds = new Map<string, PreviewKind>();

  constructor(
    contributions: Iterable<SceneContribution>
  ) {
    const packages = contributedScenePackages(contributions);
    const sources = new Map(packages.flatMap(
      ([, { assets = [] }]) => assets.map(
        (source) => [source.descriptor.kind, source] as const
      )
    ));
    for (const [, { components }] of packages) {
      for (const component of components) {
        const [slot, ...others] = Object.entries(requiredAssetSlots(component));
        const source = slot === undefined ?
          undefined :
          sources.get(slot[1].kind.value);
        if (
          source !== undefined &&
          others.length === 0 &&
          !this.#kinds.has(source.descriptor.kind)
        ) {
          this.#kinds.set(source.descriptor.kind, {
            source,
            component,
            slot: slot[0]
          });
        }
      }
    }
  }

  find(
    kind: string
  ): PreviewKind | undefined {
    return this.#kinds.get(kind);
  }
}
