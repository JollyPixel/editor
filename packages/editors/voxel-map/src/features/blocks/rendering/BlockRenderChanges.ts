// Import Internal Dependencies
import type { BlockRenderSources } from "./BlockRenderSources.ts";

export type BlockRenderChange = "atlases" | "materialGroups";

export class BlockRenderChanges {
  readonly #sources: BlockRenderSources;
  #atlasVersion: number;
  #groupsVersion: number;

  constructor(
    sources: BlockRenderSources
  ) {
    this.#sources = sources;
    this.#atlasVersion = sources.atlases.version;
    this.#groupsVersion = this.#currentGroupsVersion();
  }

  poll(): BlockRenderChange | null {
    const atlasVersion = this.#sources.atlases.version;
    const groupsVersion = this.#currentGroupsVersion();
    const atlasChanged = atlasVersion !== this.#atlasVersion;
    const groupsChanged = groupsVersion !== this.#groupsVersion;
    this.#atlasVersion = atlasVersion;
    this.#groupsVersion = groupsVersion;

    if (atlasChanged) {
      return "atlases";
    }

    return groupsChanged ? "materialGroups" : null;
  }

  #currentGroupsVersion(): number {
    return this.#sources.materialGroups?.version ?? -1;
  }
}
