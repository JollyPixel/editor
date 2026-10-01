// Import Internal Dependencies
import type { AssetPath } from "./AssetPath.ts";
import type { AssetRelocation } from "./AssetTreeModel.ts";

export type FolderMove = Pick<
  AssetRelocation,
  "from" | "to"
>;

export class DraftFolders implements Iterable<AssetPath> {
  static readonly EMPTY = new DraftFolders([]);

  #paths: ReadonlyMap<string, AssetPath>;

  constructor(
    paths: Iterable<AssetPath>
  ) {
    this.#paths = new Map(
      [...paths].map((path) => [path.toString(), path])
    );
  }

  get size(): number {
    return this.#paths.size;
  }

  with(
    path: AssetPath
  ): DraftFolders {
    return new DraftFolders([...this, path]);
  }

  rebased(
    moves: Iterable<FolderMove>
  ): DraftFolders {
    const list = [...moves];
    const current = [...this];
    const rebased = current.map((path) => list.reduce(
      (folder, move) => folder.rebase(move.from, move.to),
      path
    ));

    return rebased.every((path, index) => path === current[index]) ?
      this :
      new DraftFolders(rebased);
  }

  without(
    folders: readonly AssetPath[]
  ): DraftFolders {
    return this.#filter((path) => !folders.some(
      (folder) => path.equals(folder) || path.isUnder(folder)
    ));
  }

  unpopulated(
    assetPaths: readonly AssetPath[]
  ): DraftFolders {
    return this.#filter(
      (path) => !assetPaths.some((assetPath) => assetPath.isUnder(path))
    );
  }

  [Symbol.iterator](): IterableIterator<AssetPath> {
    return this.#paths.values();
  }

  #filter(
    keep: (path: AssetPath) => boolean
  ): DraftFolders {
    const kept = [...this].filter(keep);

    return kept.length === this.size
      ? this
      : new DraftFolders(kept);
  }
}
