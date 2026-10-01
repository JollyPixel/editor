// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetPath } from "./AssetPath.ts";

export interface CompanionCandidate {
  id: string;
  path: AssetPath;
}

export type ReferencesOf = (assetId: string) => readonly AssetReferenceData[];

export class AssetCompanions {
  static readonly EMPTY = new AssetCompanions(
    new Map()
  );

  #owners: ReadonlyMap<string, string>;
  #companions = new Map<string, string[]>();

  constructor(
    owners: ReadonlyMap<string, string>
  ) {
    this.#owners = new Map(owners);

    for (const [assetId, ownerId] of this.#owners) {
      this.#companions.set(ownerId, [
        ...this.#companions.get(ownerId) ?? [],
        assetId
      ]);
    }
  }

  static pair(
    assets: Iterable<CompanionCandidate>,
    referencesOf: ReferencesOf
  ): AssetCompanions {
    const candidates = [...assets];
    const referrers = new Map<string, string[]>();

    const groups = Map.groupBy(
      candidates,
      (asset) => `${asset.path.parent}/${asset.path.stem}`
    );
    for (const group of groups.values()) {
      if (group.length < 2) {
        continue;
      }
      for (const owner of group) {
        const referenced = new Set(
          referencesOf(owner.id)
            .map((reference) => reference.id)
        );
        for (const asset of group) {
          if (asset !== owner && referenced.has(asset.id)) {
            referrers.set(asset.id, [
              ...referrers.get(asset.id) ?? [],
              owner.id
            ]);
          }
        }
      }
    }

    const owners = new Map<string, string>();
    for (const asset of candidates) {
      const owner = soleReferrerOf(referrers, asset.id);
      if (
        owner !== undefined &&
        soleReferrerOf(referrers, owner) === undefined
      ) {
        owners.set(asset.id, owner);
      }
    }

    return new AssetCompanions(owners);
  }

  ownerOf(
    assetId: string
  ): string | undefined {
    return this.#owners.get(assetId);
  }

  companionsOf(
    ownerId: string
  ): readonly string[] {
    return [
      ...this.#companions.get(ownerId) ?? []
    ];
  }
}

function soleReferrerOf(
  referrers: ReadonlyMap<string, readonly string[]>,
  assetId: string
): string | undefined {
  const ids = referrers.get(assetId);

  return ids?.length === 1 ? ids[0] : undefined;
}
