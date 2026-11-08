// Import Third-party Dependencies
import type { AssetType } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type {
  SceneComponentKind,
  SceneComponentPackage
} from "./SceneComponentPackage.ts";

export interface SceneContribution {
  readonly name: string;
  readonly module: {
    readonly SCENE_COMPONENTS?: SceneComponentPackage;
  };
}

export type NamedSceneComponentPackage = readonly [
  name: string,
  components: SceneComponentPackage
];

export type AssetSlots = Readonly<Record<string, AssetType<unknown>>>;

export function contributedScenePackages(
  contributions: Iterable<SceneContribution>
): NamedSceneComponentPackage[] {
  return Array.from(contributions, ({ name, module }) => {
    if (module.SCENE_COMPONENTS === undefined) {
      throw new TypeError(
        `"${name}" declares "jollypixel.scene" but does not export "SCENE_COMPONENTS".`
      );
    }

    return [name, module.SCENE_COMPONENTS] as const;
  });
}

export function requiredAssetSlots(
  kind: SceneComponentKind
): AssetSlots {
  const optional = new Set<string>(kind.optionalAssets);

  return Object.fromEntries(
    Object.entries(kind.definition.assets ?? {})
      .filter(([name]) => !optional.has(name))
  );
}
