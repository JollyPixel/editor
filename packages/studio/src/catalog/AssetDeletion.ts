// Import Internal Dependencies
import type { AssetPath } from "./AssetPath.ts";
import type {
  AssetLeafData,
  AssetNodeData
} from "./AssetTreeModel.ts";

export interface AssetDeletionInit {
  targets: readonly AssetNodeData[];
  assets: readonly AssetLeafData[];
  companions: readonly AssetLeafData[];
  dependents: readonly string[];
  dependentsWithCompanions: readonly string[];
}

export class AssetDeletion {
  readonly targets: readonly AssetNodeData[];
  readonly assets: readonly AssetLeafData[];
  readonly companions: readonly AssetLeafData[];

  #dependents: readonly string[];
  #dependentsWithCompanions: readonly string[];

  constructor(
    init: AssetDeletionInit
  ) {
    this.targets = [
      ...init.targets
    ];
    this.assets = [
      ...init.assets
    ];
    this.companions = [
      ...init.companions
    ];
    this.#dependents = [
      ...init.dependents
    ];
    this.#dependentsWithCompanions = [
      ...init.dependentsWithCompanions
    ];
  }

  get isEmpty(): boolean {
    return this.assets.length === 0;
  }

  get folders(): AssetPath[] {
    return this.targets.flatMap(
      (target) => (target.type === "folder" ? [target.path] : [])
    );
  }

  removals(
    withCompanions: boolean
  ): AssetLeafData[] {
    return withCompanions ?
      [...this.assets, ...this.companions] :
      [...this.assets];
  }

  dependents(
    withCompanions: boolean
  ): readonly string[] {
    return withCompanions ?
      this.#dependentsWithCompanions :
      this.#dependents;
  }
}
